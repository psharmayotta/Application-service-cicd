import DeploymentService from '../src/services/deployments/deploymentService.services';
import { DeploymentModel } from '../src/database/repository/deployment/deployment.model';
import { InfraModuleEntity } from '../src/entities/infraModuleEntity';
import { InfraAllocationEntity } from '../src/entities/infraAllocationEntity';
import { ModelEntity } from '../src/entities/modelEntity';
import { ModelClassEntity } from '../src/entities/modelClassEntity';
import { ModelTrainingEntity } from '../src/entities/modelTrainingEntity';
import { NimModelEntity } from '../src/entities/nimModelEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { NodeGroupsEntity } from '../src/entities/nodeGroupsEntity';
import { QuantizationEntity } from '../src/entities/quantizationEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { DeploymentKbIntegrationEntity } from '../src/entities/deploymentKbIntegrationEntity';
import AuditLogService from '../src/services/auditLog/auditLogService.services';
import {
    DeploymentStatus,
    DeploymentType,
    DEPLOYMENTPROCESS,
    NodeAntiAffinity,
    InfraAllocationModuleType,
} from '../src/config';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mockKafkaInstance = {
        sendMessage: jest.fn().mockResolvedValue(true),
    };
    return {
        KafkaService: {
            getInstance: jest.fn().mockReturnValue(mockKafkaInstance),
        },
    };
});

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: {
        pushMessageToCompany: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: {
        log: jest.fn().mockResolvedValue(true),
        logFailureIncident: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../src/services/notification/notificationService.services', () => ({
    NotificationService: class {
        createRecord = jest.fn().mockResolvedValue({ id: 1 });
    },
}));

jest.mock('../src/services/quota/deploymentQuotaService.service', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        createRecord: jest.fn().mockResolvedValue({}),
        deleteQuotaByModelId: jest.fn().mockResolvedValue(true),
    })),
}));

describe('DeploymentService Unit Tests', () => {
    let service: DeploymentService;
    let mockKafkaInstance: any;

    beforeEach(() => {
        service = new DeploymentService();
        mockKafkaInstance = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return correct module name', () => {
            expect(service.getModuleName()).toBe('Deployment');
        });

        test('should return DeploymentModel from getModel', () => {
            const model = service.getModel();
            expect(model).toBeInstanceOf(DeploymentModel);
        });

        test('should return DTO class', () => {
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign user_id from decryptToken.member_id', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 42 };

            const result = service.transformModel(model);

            expect(result.user_id).toBe(42);
        });

        test('should set default module_type_id to 4 if not already set', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };

            const result = service.transformModel(model);

            expect(result.module_type_id).toBe(4);
        });

        test('should not override module_type_id if already set', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.module_type_id = 7;

            const result = service.transformModel(model);

            expect(result.module_type_id).toBe(7);
        });

        test('should set module_type to deployment by default', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.module_type = null as any;

            const result = service.transformModel(model);

            expect(result.module_type).toBe(InfraAllocationModuleType.DEPLOYMENT);
        });

        test('should assign module_id from model_id', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.model_id = 55;

            const result = service.transformModel(model);

            expect(result.module_id).toBe(55);
        });

        test('should generate slug from deployment_name', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.deployment_name = 'My Test Deployment!';
            model.slug = '';

            const result = service.transformModel(model);

            expect(result.slug).toBe('my-test-deployment');
        });

        test('should build config object from model fields', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.description = 'Test desc';
            model.gpu_type = 'A100';
            model.cpu_cores = 8;
            model.gpu_count_per_pod = 4;
            model.node_groups = [1, 2];

            const result = service.transformModel(model);

            expect(result.config).toEqual({
                description: 'Test desc',
                gpu_type: 'A100',
                cpu_cores: 8,
                gpu_count_per_pod: 4,
                node_groups: [1, 2],
            });
        });

        test('should set scaling parameters when scaling object is provided', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.scaling = {
                node_anti_affinity: true,
                auto_scaling: {
                    min_replicas: 1,
                    max_replicas: 5,
                    metrics: { cpu: 80 },
                },
            };

            const result = service.transformModel(model);

            expect(result.node_anti_affinity).toBe(NodeAntiAffinity.REQUIRED);
            expect(result.min_pod_count).toBe(1);
            expect(result.max_pod_count).toBe(5);
            expect(result.scaling_metric).toEqual({ cpu: 80 });
        });

        test('should set NOTREQUIRED anti-affinity when scaling.node_anti_affinity is false', () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.scaling = { node_anti_affinity: false };

            const result = service.transformModel(model);

            expect(result.node_anti_affinity).toBe(NodeAntiAffinity.NOTREQUIRED);
        });
    });

    describe('createPreProcess', () => {
        let infraModuleSpy: jest.SpyInstance;

        beforeEach(() => {
            infraModuleSpy = jest.spyOn(InfraModuleEntity, 'findOneBy');
        });

        afterEach(() => {
            infraModuleSpy.mockRestore();
        });

        test('should look up module by deployment_type and assign module_type_id', async () => {
            infraModuleSpy.mockResolvedValue({ id: 7, name: 'training' });

            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.deployment_type = DeploymentType.TRAINING;

            const result = await service.createPreProcess(model, null);

            expect(infraModuleSpy).toHaveBeenCalledWith({ name: DeploymentType.TRAINING });
            expect(result.module_type_id).toBe(7);
        });

        test('should keep default module_type_id if deployment_type is not provided', async () => {
            const model = new DeploymentModel();
            model.decryptToken = { member_id: 1 };
            model.deployment_type = null as any;

            const result = await service.createPreProcess(model, null);

            expect(result.module_type_id).toBe(4);
        });
    });

    describe('createPostProcess - Docker deployment', () => {
        let modelEntitySpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;
        let nodeGroupsSpy: jest.SpyInstance;

        beforeEach(() => {
            modelEntitySpy = jest.spyOn(ModelEntity, 'findOneBy');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
            nodeGroupsSpy = jest.spyOn(NodeGroupsEntity, 'findBy');
        });

        afterEach(() => {
            modelEntitySpy.mockRestore();
            membersSpy.mockRestore();
            nodeGroupsSpy.mockRestore();
        });

        test('should send Kafka message for docker deployment', async () => {
            modelEntitySpy.mockResolvedValue({
                id: 10,
                name: 'DockerModel',
                cpu_request: '1',
                cpu_limit: '2',
                memory_request: '512Mi',
                memory_limit: '1Gi',
                overall_configuration: { env: 'test' },
            });
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Test User' });
            nodeGroupsSpy.mockResolvedValue([{ id: 1, name: 'gpu-pool' }]);

            const result = {
                id: 100,
                company_id: 10,
                user_id: 1,
                module_id: 10,
                deployment_name: 'Docker Deploy',
                slug: 'docker-deploy',
                scaling_parameters: null,
                cluster_id: 5,
            } as any;

            const model = new DeploymentModel();
            model.deployment_type = DeploymentType.DOCKER;
            model.gpu_count_per_pod = 2;
            model.node_groups = [1];

            const returned = await service.createPostProcess(result, model, null);

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: 100,
                    is_docker: true,
                    deployment_type: 'docker',
                })
            );
            expect(returned).toBe(result);
        });
    });

    describe('createPostProcess - NIM deployment', () => {
        let nimModelSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;
        let nodeGroupsSpy: jest.SpyInstance;

        beforeEach(() => {
            nimModelSpy = jest.spyOn(NimModelEntity, 'findOneBy');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
            nodeGroupsSpy = jest.spyOn(NodeGroupsEntity, 'findBy');
        });

        afterEach(() => {
            nimModelSpy.mockRestore();
            membersSpy.mockRestore();
            nodeGroupsSpy.mockRestore();
        });

        test('should send Kafka message for NIM deployment with NIM-specific fields', async () => {
            nimModelSpy.mockResolvedValue({
                id: 20,
                name: 'Llama-NIM',
                image: 'nvcr.io/nim/llama:latest',
                publisher: 'NVIDIA',
                category: 'LLM',
            });
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Test User' });
            nodeGroupsSpy.mockResolvedValue([]);

            const result = {
                id: 200,
                company_id: 10,
                user_id: 1,
                module_id: 20,
                deployment_name: 'NIM Deploy',
                slug: 'nim-deploy',
                scaling_parameters: null,
                cluster_id: 5,
            } as any;

            const model = new DeploymentModel();
            model.deployment_type = DeploymentType.NIM;
            model.gpu_count_per_pod = 1;
            model.node_groups = [];

            const returned = await service.createPostProcess(result, model, null);

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: 200,
                    is_nim: true,
                    nim_model_id: 20,
                    image: 'nvcr.io/nim/llama:latest',
                    deployment_type: 'nim',
                })
            );
            expect(returned).toBe(result);
        });
    });

    describe('createPostProcess - Playground deployment', () => {
        let modelEntitySpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;
        let nodeGroupsSpy: jest.SpyInstance;
        let modelClassSpy: jest.SpyInstance;

        beforeEach(() => {
            modelEntitySpy = jest.spyOn(ModelEntity, 'findOneBy');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
            nodeGroupsSpy = jest.spyOn(NodeGroupsEntity, 'findBy');
            modelClassSpy = jest.spyOn(ModelClassEntity, 'findOneBy');
        });

        afterEach(() => {
            modelEntitySpy.mockRestore();
            membersSpy.mockRestore();
            nodeGroupsSpy.mockRestore();
            modelClassSpy.mockRestore();
        });

        test('should send Kafka message with model details for playground deployment', async () => {
            modelEntitySpy.mockResolvedValue({
                id: 5,
                name: 'GPT-Model',
                model_class_id: 2,
                quantization_id: null,
            });
            modelClassSpy.mockResolvedValue({ id: 2, name: 'Transformer' });
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Dev User' });
            nodeGroupsSpy.mockResolvedValue([{ id: 1, name: 'default-pool' }]);

            const result = {
                id: 300,
                company_id: 10,
                user_id: 1,
                module_id: 5,
                deployment_name: 'PG Deploy',
                slug: 'pg-deploy',
                scaling_parameters: null,
                cluster_id: 3,
            } as any;

            const model = new DeploymentModel();
            model.deployment_type = DeploymentType.PLAYGROUND;
            model.node_groups = [1];

            const returned = await service.createPostProcess(result, model, null);

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: 300,
                    model_name: 'GPT-Model',
                    model_class: 'Transformer',
                    process: DEPLOYMENTPROCESS.CREATE,
                })
            );
            expect(returned).toBe(result);
        });
    });

    describe('processDeploymentStatus (static)', () => {
        test('should map RESUMED to START', () => {
            const item = { status: 'RESUMED', is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.status).toBe(DeploymentStatus.START);
        });

        test('should map END to PAUSED when not deleted', () => {
            const item = { status: DeploymentStatus.END, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.status).toBe(DeploymentStatus.PAUSED);
        });

        test('should map END to DELETED when is_delete=1', () => {
            const item = { status: DeploymentStatus.END, is_delete: 1 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.status).toBe(DeploymentStatus.DELETED);
        });

        test('should set all progress flags for PENDING', () => {
            const item = { status: DeploymentStatus.PENDING, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.deployment_accepted).toBe(true);
            expect(item.connect_to_cluster).toBe(false);
            expect(item.model_deployment).toBe(false);
            expect(item.health_check).toBe(false);
        });

        test('should set all progress flags for START', () => {
            const item = { status: DeploymentStatus.START, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.deployment_accepted).toBe(true);
            expect(item.connect_to_cluster).toBe(true);
            expect(item.model_deployment).toBe(false);
        });

        test('should set all progress flags for READY', () => {
            const item = { status: DeploymentStatus.READY, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.deployment_accepted).toBe(true);
            expect(item.connect_to_cluster).toBe(true);
            expect(item.model_deployment).toBe(true);
            expect(item.health_check).toBe(true);
        });

        test('should set scale_down for PAUSED', () => {
            const item = { status: DeploymentStatus.PAUSED, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.scale_down).toBe(true);
        });

        test('should not set scale_down for FAILED', () => {
            const item = { status: DeploymentStatus.FAILED, is_delete: 0 } as any;

            DeploymentService.processDeploymentStatus(item);

            expect(item.scale_down).toBe(false);
        });
    });

    describe('updateStatus', () => {
        let findOneBySpy: jest.SpyInstance;
        let infraModuleSpy: jest.SpyInstance;
        let modelEntitySpy: jest.SpyInstance;
        let modelClassSpy: jest.SpyInstance;
        let nodeGroupsSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;
        let deIntegrateSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = {
                findOneBy: findOneBySpy,
                update: entityUpdateSpy,
            } as any;
            infraModuleSpy = jest.spyOn(InfraModuleEntity, 'findOneBy');
            modelEntitySpy = jest.spyOn(ModelEntity, 'findOneBy');
            modelClassSpy = jest.spyOn(ModelClassEntity, 'findOneBy');
            nodeGroupsSpy = jest.spyOn(NodeGroupsEntity, 'findBy');
            deIntegrateSpy = jest.spyOn(DeploymentKbIntegrationEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            infraModuleSpy.mockRestore();
            modelEntitySpy.mockRestore();
            modelClassSpy.mockRestore();
            nodeGroupsSpy.mockRestore();
            deIntegrateSpy.mockRestore();
        });

        test('should throw E10062 if deployment not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            await expect(service.updateStatus({ id: 999 })).rejects.toBe('E10062');
        });

        test('should send PAUSE Kafka message and log audit', async () => {
            findOneBySpy.mockResolvedValue({
                id: 1,
                company_id: 10,
                user_id: 5,
                module_id: 50,
                module_type_id: 4,
                deployment_name: 'TestDeploy',
                slug: 'test-deploy',
                scaling_parameters: null,
                config: { node_groups: [] },
                cluster_id: 3,
            });
            infraModuleSpy.mockResolvedValue({ id: 4, name: 'playground' });
            modelEntitySpy.mockResolvedValue({
                id: 50,
                name: 'TestModel',
                model_class_id: 2,
                quantization_id: null,
                company_id: null,
                member_id: null,
                is_docker: false,
            });
            modelClassSpy.mockResolvedValue({ id: 2, name: 'Transformer' });
            nodeGroupsSpy.mockResolvedValue([]);

            const result = await service.updateStatus({
                id: 1,
                status: 'PAUSE',
                decryptToken: { member_id: 5 },
            });

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: 1,
                    process: 'PAUSE',
                })
            );
            expect(result.process).toBe('PAUSE');
            expect(AuditLogService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'PAUSE', entity_id: 1 })
            );
        });

        test('should soft-delete and de-integrate KB on DELETE', async () => {
            findOneBySpy.mockResolvedValue({
                id: 2,
                company_id: 10,
                user_id: 5,
                module_id: 50,
                module_type_id: 4,
                deployment_name: 'DelDeploy',
                slug: 'del-deploy',
                scaling_parameters: null,
                config: { node_groups: [] },
                cluster_id: 3,
            });
            infraModuleSpy.mockResolvedValue({ id: 4, name: 'playground' });
            modelEntitySpy.mockResolvedValue({
                id: 50,
                name: 'TestModel',
                model_class_id: null,
                quantization_id: null,
                company_id: null,
                member_id: null,
                is_docker: false,
            });
            nodeGroupsSpy.mockResolvedValue([]);

            // Mock prepareQueryById for WebSocket push
            jest.spyOn(service, 'prepareQueryById' as any).mockResolvedValue({ id: 2, company_id: 10 });

            await service.updateStatus({
                id: 2,
                status: 'DELETE',
                decryptToken: { member_id: 5 },
            });

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 2 }, { is_delete: 1 });
            expect(deIntegrateSpy).toHaveBeenCalledWith(
                { deployment_id: 2, is_delete: 0 },
                { is_active: false, is_delete: 1 }
            );
        });
    });

    describe('updateStatusFromKafka', () => {
        let findOneBySpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = {
                findOneBy: findOneBySpy,
                update: entityUpdateSpy,
            } as any;
            jest.spyOn(service, 'prepareQueryById' as any).mockResolvedValue({ id: 1, company_id: 10 });
        });

        test('should update model_endpoint and model_proxy when endpoint is provided', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, company_id: 10 });

            await service.updateStatusFromKafka({
                id: 1,
                inference_endpoint: 'http://model:8080/predict',
            });

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    model_proxy: 'http://model:8080/predict',
                })
            );
        });

        test('should update health_check_endpoint when provided', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, company_id: 10 });

            await service.updateStatusFromKafka({
                id: 1,
                health_check_endpoint: '/health',
            });

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    health_check_endpoint: '/health',
                })
            );
        });

        test('should soft-delete and de-integrate KB on DELETED status', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, company_id: 10 });
            const deIntegrateSpy = jest.spyOn(DeploymentKbIntegrationEntity, 'update').mockResolvedValue({} as any);

            await service.updateStatusFromKafka({
                id: 1,
                status: 'DELETED',
            });

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    is_delete: 1,
                    status: DeploymentStatus.DELETED,
                })
            );
            expect(deIntegrateSpy).toHaveBeenCalled();
            deIntegrateSpy.mockRestore();
        });

        test('should return early if deployment not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            const result = await service.updateStatusFromKafka({ id: 999 });

            expect(result).toBeUndefined();
            expect(entityUpdateSpy).not.toHaveBeenCalled();
        });

        test('should return early if no deployment_id in message', async () => {
            const result = await service.updateStatusFromKafka({});

            expect(result).toBeUndefined();
        });
    });

    describe('updateDeleteFlagData', () => {
        let mockQB: any;
        let entityFindSpy: jest.SpyInstance;
        let deIntegrateSpy: jest.SpyInstance;

        beforeEach(() => {
            mockQB = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            entityFindSpy = jest.fn();
            service.entity = {
                find: entityFindSpy,
                createQueryBuilder: jest.fn().mockReturnValue(mockQB),
            } as any;
            deIntegrateSpy = jest.spyOn(DeploymentKbIntegrationEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            deIntegrateSpy.mockRestore();
        });

        test('should soft-delete records and de-integrate KBs', async () => {
            entityFindSpy.mockResolvedValue([
                { id: 1, company_id: 10, user_id: 5, deployment_name: 'Deploy1' },
            ]);

            const result = await service.updateDeleteFlagData({
                id: 1,
                decryptToken: { member_id: 5 },
            } as any);

            expect(result).toBe(true);
            expect(deIntegrateSpy).toHaveBeenCalled();
        });

        test('should return false if no records to delete', async () => {
            entityFindSpy.mockResolvedValue(null);

            const result = await service.updateDeleteFlagData({ id: 999 } as any);

            expect(result).toBe(false);
        });
    });
});
