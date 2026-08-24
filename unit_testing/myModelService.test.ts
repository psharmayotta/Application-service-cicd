import MyModelService from '../src/services/myModel/myModelService.service';
import { MyModelModel } from '../src/database/repository/MyModel/mymodel.model';
import { ModelEntity } from '../src/entities/modelEntity';
import { ModelClassEntity } from '../src/entities/modelClassEntity';
import { CloudProviderEntity } from '../src/entities/cloudProviderEntity';
import { CloudRegionEntity } from '../src/entities/cloudRegionEntity';
import { CloudAccountEntity } from '../src/entities/cloudAccountEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { HardwareMasterEntity } from '../src/entities/hardwareMasterEntity';
import { HardwareSpecsEntity } from '../src/entities/hardwareSpecsEntity';
import { QuantizationEntity } from '../src/entities/quantizationEntity';
import { CloudSecretsEntity } from '../src/entities/cloudSecretsEntity';
import { ModelTrainingEntity } from '../src/entities/modelTrainingEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { MyModelStatus, KAFKAPRODUCERS } from '../src/config';
import AuditLogService from '../src/services/auditLog/auditLogService.services';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mock = { sendMessage: jest.fn().mockResolvedValue(true) };
    return { KafkaService: { getInstance: jest.fn().mockReturnValue(mock) } };
});

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: { pushMessageToCompany: jest.fn().mockResolvedValue(true) },
}));

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: { log: jest.fn().mockResolvedValue(true), logFailureIncident: jest.fn().mockResolvedValue(true) },
}));

jest.mock('../src/services/notification/notificationService.services', () => ({
    NotificationService: class { createRecord = jest.fn().mockResolvedValue({ id: 1 }); },
}));

jest.mock('../src/services/cloudSecrets/cloudSecretsService.service', () => ({
    __esModule: true,
    default: { updateSecretLastUsed: jest.fn().mockResolvedValue(true) },
}));

jest.mock('../src/services/infraAvailability/infraAvailabilityService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        checkAvailabilityByUtilization: jest.fn().mockResolvedValue({ available: true, freeCount: 4 }),
    })),
}));

jest.mock('../src/services/infraQueue/infraQueueService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        addToQueue: jest.fn().mockResolvedValue({ id: 1 }),
    })),
}));

jest.mock('../src/utils/pricing/pricingService', () => ({
    PricingService: { getPricePerSec: jest.fn().mockResolvedValue(0.001) },
}));

describe('MyModelService Unit Tests', () => {
    let service: MyModelService;
    let mockKafka: any;

    beforeEach(() => {
        service = new MyModelService();
        mockKafka = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "My Model" as module name', () => {
            expect(service.getModuleName()).toBe('My Model');
        });

        test('should return MyModelModel', () => {
            expect(service.getModel()).toBeInstanceOf(MyModelModel);
        });
    });

    describe('transformModel', () => {
        test('should set status to JOB_RECEIVED', () => {
            const model = new MyModelModel();
            model.decryptToken = { member_id: 42 };
            const result = service.transformModel(model);
            expect(result.status).toBe(MyModelStatus.JOB_RECEIVED);
        });

        test('should assign member_id from decryptToken', () => {
            const model = new MyModelModel();
            model.decryptToken = { member_id: 42 };
            const result = service.transformModel(model);
            expect(result.member_id).toBe(42);
        });

        test('should generate model_unique_key as 64 char SHA256', () => {
            const model = new MyModelModel();
            model.decryptToken = { member_id: 1 };
            const result = service.transformModel(model);
            expect(result.model_unique_key).toHaveLength(64);
        });
    });

    describe('prepareQuery', () => {
        let mockQB: any;

        beforeEach(() => {
            mockQB = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, name: 'Model1', profile_picture: null, cloud_provider_image: null, member_id: 5, quantization_id: null },
                ]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = { createQueryBuilder: jest.fn().mockReturnValue(mockQB) } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should return paginated data', async () => {
            const response = await service.prepareQuery({ company_id: 10, pageNumber: 1, pageSize: 10 } as any);
            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
            expect(response.pagination.pageSize).toBe(10);
        });

        test('should apply company_id and is_delete filters', async () => {
            await service.prepareQuery({ company_id: 10 } as any);
            expect(mockQB.where).toHaveBeenCalledWith('model.company_id = :company_id', { company_id: 10 });
            expect(mockQB.andWhere).toHaveBeenCalledWith('model.is_delete = :is_delete', { is_delete: 0 });
        });

        test('should apply search filter', async () => {
            await service.prepareQuery({ company_id: 10, search_text: 'llama' } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith('LOWER(model.name) LIKE :search', { search: '%llama%' });
        });

        test('should apply status filter (single)', async () => {
            await service.prepareQuery({ company_id: 10, status: 'SUCCESS' } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'LOWER(model.status) IN (:...status)',
                { status: ['success'] }
            );
        });

        test('should apply status filter (array)', async () => {
            await service.prepareQuery({ company_id: 10, status: ['SUCCESS', 'FAILED'] } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'LOWER(model.status) IN (:...status)',
                { status: ['success', 'failed'] }
            );
        });

        test('should handle profile_picture with http URL', async () => {
            mockQB.getRawMany.mockResolvedValue([
                { id: 1, name: 'M1', profile_picture: 'https://example.com/pic.png', cloud_provider_image: null, member_id: 5, quantization_id: null },
            ]);
            const response = await service.prepareQuery({ company_id: 10 } as any);
            expect(response.data[0].profile_picture_signed_url).toBe('https://example.com/pic.png');
        });
    });

    describe('prepareQueryById', () => {
        let entityFindOneSpy: jest.SpyInstance;
        let modelClassSpy: jest.SpyInstance;
        let cloudProviderSpy: jest.SpyInstance;
        let regionSpy: jest.SpyInstance;
        let accountSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindOneSpy = jest.fn();
            service.entity = { findOne: entityFindOneSpy } as any;
            modelClassSpy = jest.spyOn(ModelClassEntity, 'findOneBy');
            cloudProviderSpy = jest.spyOn(CloudProviderEntity, 'findOneBy');
            regionSpy = jest.spyOn(CloudRegionEntity, 'findOneBy');
            accountSpy = jest.spyOn(CloudAccountEntity, 'findOneBy');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
            jest.spyOn(HardwareSpecsEntity, 'createQueryBuilder').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ id: 1, model_name: 'A100' }),
            } as any);
        });

        afterEach(() => {
            modelClassSpy.mockRestore();
            cloudProviderSpy.mockRestore();
            regionSpy.mockRestore();
            accountSpy.mockRestore();
            membersSpy.mockRestore();
        });

        test('should throw if id is not provided', async () => {
            await expect(service.prepareQueryById({} as any)).rejects.toThrow('Model ID is required');
        });

        test('should throw if model not found', async () => {
            entityFindOneSpy.mockResolvedValue(null);
            await expect(service.prepareQueryById({ id: 999 } as any)).rejects.toThrow('Model not found');
        });

        test('should return enriched model data', async () => {
            entityFindOneSpy.mockResolvedValue({
                id: 1, model_class_id: 2, cloud_provider_id: 3, region_id: 4,
                cloud_account_id: 5, member_id: 6, accelerator_id: 7, host_provider: null,
                name: 'TestModel', registry: null, docker_image_url: null,
            });
            modelClassSpy.mockResolvedValue({ id: 2, name: 'Transformer' });
            cloudProviderSpy.mockResolvedValue({ id: 3, name: 'AWS', cloud_provider_image: null });
            regionSpy.mockResolvedValue({ id: 4, name: 'us-east-1' });
            accountSpy.mockResolvedValue({ id: 5, account_name: 'Prod Account' });
            membersSpy.mockResolvedValue({ id: 6, full_name: 'Dev User' });

            const result = await service.prepareQueryById({ id: 1 } as any);

            expect(result.modelClass).toBe('Transformer');
            expect(result.cloud_provider).toBe('AWS');
            expect(result.region).toBe('us-east-1');
            expect(result.createdBy).toBe('Dev User');
        });
    });

    describe('createPostProcess', () => {
        let modelClassSpy: jest.SpyInstance;
        let hardwareSpy: jest.SpyInstance;
        let cloudProviderSpy: jest.SpyInstance;
        let regionSpy: jest.SpyInstance;
        let accountSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;
        let quantizationSpy: jest.SpyInstance;
        let secretsSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            modelClassSpy = jest.spyOn(ModelClassEntity, 'findOneBy').mockResolvedValue({ id: 1, name: 'LLM' } as any);
            hardwareSpy = jest.spyOn(HardwareMasterEntity, 'findOneBy').mockResolvedValue({ id: 1, model_name: 'A100' } as any);
            cloudProviderSpy = jest.spyOn(CloudProviderEntity, 'findOneBy').mockResolvedValue({ id: 1, name: 'HuggingFace' } as any);
            regionSpy = jest.spyOn(CloudRegionEntity, 'findOneBy').mockResolvedValue({ id: 1, name: 'us-east-1' } as any);
            accountSpy = jest.spyOn(CloudAccountEntity, 'findOneBy').mockResolvedValue({ id: 1, account_name: 'TestAcc' } as any);
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy').mockResolvedValue({ id: 1, full_name: 'Dev' } as any);
            quantizationSpy = jest.spyOn(QuantizationEntity, 'findOneBy').mockResolvedValue({ id: 1, name: 'FLOAT16' } as any);
            secretsSpy = jest.spyOn(CloudSecretsEntity, 'findOneBy').mockResolvedValue(null);
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = { update: entityUpdateSpy, findOneBy: jest.fn() } as any;
        });

        afterEach(() => {
            modelClassSpy.mockRestore();
            hardwareSpy.mockRestore();
            cloudProviderSpy.mockRestore();
            regionSpy.mockRestore();
            accountSpy.mockRestore();
            membersSpy.mockRestore();
            quantizationSpy.mockRestore();
            secretsSpy.mockRestore();
        });

        test('should send Kafka message with MYMODEL topic for non-compiled model', async () => {
            const result = {
                id: 1, company_id: 10, member_id: 5, name: 'NewModel',
                model_class_id: 1, accelerator_id: 1, cloud_provider_id: 1,
                region_id: 1, cloud_account_id: 1, quantization_id: 1,
                model_source_repo: 'hf/model', is_compiled: false, is_docker: false,
                cloud_secret_id: null, host_provider: null, accelerator_count: 2,
            } as any;

            const returned = await service.createPostProcess(result);

            expect(mockKafka.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.MYMODEL,
                expect.objectContaining({ id: 1, org_id: 10 })
            );
            expect(returned).toBe(result);
        });

        test('should mark model as docker if cloud provider is Docker', async () => {
            cloudProviderSpy.mockResolvedValue({ id: 1, name: 'Docker' } as any);

            const result = {
                id: 2, company_id: 10, member_id: 5, name: 'DockerModel',
                model_class_id: 1, accelerator_id: null, cloud_provider_id: 1,
                region_id: 1, cloud_account_id: 1, quantization_id: 1,
                model_source_repo: '', is_compiled: false, is_docker: false,
                cloud_secret_id: null, host_provider: null, accelerator_count: null,
            } as any;

            await service.createPostProcess(result);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 2 }, { is_docker: true });
        });

        test('should use COMPILEINIT topic for compiled models', async () => {
            jest.spyOn(ModelTrainingEntity, 'createQueryBuilder').mockReturnValue({
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ model_name: 'BaseModel' }),
            } as any);

            const result = {
                id: 3, company_id: 10, member_id: 5, name: 'CompiledModel',
                model_class_id: 1, accelerator_id: null, cloud_provider_id: 1,
                region_id: 1, cloud_account_id: 1, quantization_id: 1,
                model_source_repo: '', is_compiled: true, is_docker: false,
                training_id: 50, cloud_secret_id: null, host_provider: null,
                accelerator_count: null,
            } as any;

            await service.createPostProcess(result);

            expect(mockKafka.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.COMPILEINIT,
                expect.objectContaining({ id: 3, is_compiled: true, training_id: 50 })
            );
        });
    });

    describe('updateStatus', () => {
        let findOneBySpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = { findOneBy: findOneBySpy, update: entityUpdateSpy } as any;
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
        });

        afterEach(() => { membersSpy.mockRestore(); });

        test('should reject with E10043 if model not found', async () => {
            findOneBySpy.mockResolvedValue(null);
            const model = new MyModelModel();
            model.id = 999;
            await expect(service.updateStatus(model)).rejects.toBe('E10043');
        });

        test('should ignore older status updates', async () => {
            findOneBySpy.mockResolvedValue({
                id: 1, status: MyModelStatus.LAUNCHED_OPTIMISATION_CLUSTER, status_log: [], company_id: 10,
            });
            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.QUEUED;
            const result = await service.updateStatus(model);
            expect(result).toBe('Ignored older status update');
            expect(entityUpdateSpy).not.toHaveBeenCalled();
        });

        test('should update status for valid progression', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.JOB_RECEIVED, status_log: [], company_id: 10, member_id: 5, created_at: new Date() })
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.ACCEPTED, company_id: 10, member_id: 5 });
            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.ACCEPTED;
            const result = await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({ status: MyModelStatus.ACCEPTED }));
            expect(result).toBe('Model Status Updated Successfully');
        });

        test('should calculate execution_time on MODEL_READY', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.SAVING_DONE, status_log: [], company_id: 10, member_id: 5, created_at: new Date(Date.now() - 60000), accelerator_id: 3 })
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.MODEL_READY, execution_time: 60, company_id: 10, member_id: 5, name: 'M1' });
            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.MODEL_READY;
            await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({
                status: MyModelStatus.MODEL_READY,
                execution_time: expect.any(Number),
            }));
            expect(mockKafka.sendMessage).toHaveBeenCalledWith(KAFKAPRODUCERS.CREDITCALCULATE, expect.objectContaining({ module: 'Mymodel' }));
            expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
                entity_id: 1,
                entity_name: 'M1',
            }));
        });

        test('should not duplicate completion audit for an already completed model', async () => {
            findOneBySpy.mockResolvedValue({
                id: 1, status: MyModelStatus.MODEL_READY, status_log: [], company_id: 10,
                member_id: 5, name: 'M1', created_at: new Date(),
            });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.MODEL_READY;
            await service.updateStatus(model);

            expect(AuditLogService.log).not.toHaveBeenCalled();
        });

        test('should log completion when the first terminal status received is SUCCESS', async () => {
            findOneBySpy
                .mockResolvedValueOnce({
                    id: 1, status: MyModelStatus.CLEANED_UP, status_log: [], company_id: 10,
                    member_id: 5, name: 'M1', created_at: new Date(), accelerator_id: null,
                })
                .mockResolvedValueOnce({
                    id: 1, status: MyModelStatus.SUCCESS, company_id: 10, member_id: 5, name: 'M1',
                });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.SUCCESS;
            await service.updateStatus(model);

            expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
                entity_id: 1,
            }));
        });

        test('should set execution_time to 0 on FAILED', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.ACCEPTED, status_log: [], company_id: 10, member_id: 5, created_at: new Date() })
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.FAILED, execution_time: 0, company_id: 10, member_id: 5, name: 'M1' });
            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.FAILED;
            await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, expect.objectContaining({ execution_time: 0 }));
        });

        test('should send notification on MODEL_READY', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.SAVING_DONE, status_log: [], company_id: 10, member_id: 5, created_at: new Date(Date.now() - 1000), accelerator_id: null })
                .mockResolvedValueOnce({ id: 1, status: MyModelStatus.MODEL_READY, execution_time: 1, company_id: 10, member_id: 5, name: 'M1' });
            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new MyModelModel();
            model.id = 1;
            model.status = MyModelStatus.MODEL_READY;
            await service.updateStatus(model);

            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith('10', expect.any(Object));
        });
    });

    describe('updateDeleteFlagData', () => {
        let mockQB: any;
        let findSpy: jest.SpyInstance;

        beforeEach(() => {
            mockQB = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) };
            findSpy = jest.fn();
            service.entity = { find: findSpy, createQueryBuilder: jest.fn().mockReturnValue(mockQB) } as any;
        });

        test('should soft-delete records', async () => {
            findSpy.mockResolvedValue([{ id: 1, company_id: 10, member_id: 5, name: 'Model1' }]);
            const result = await service.updateDeleteFlagData({ id: 1, decryptToken: { member_id: 5 } } as any);
            expect(result).toBe(true);
            expect(mockQB.set).toHaveBeenCalledWith({ is_delete: 1 });
        });

        test('should return false if no records', async () => {
            findSpy.mockResolvedValue(null);
            const result = await service.updateDeleteFlagData({ id: 999 } as any);
            expect(result).toBe(false);
        });

        test('should return false if no id', async () => {
            const result = await service.updateDeleteFlagData({} as any);
            expect(result).toBe(false);
        });
    });
});
