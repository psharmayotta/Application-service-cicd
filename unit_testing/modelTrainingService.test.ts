import ModelTrainingService from '../src/services/modelTraining/modelTrainingService.services';
import { ModelTrainingModel } from '../src/database/repository/modelTraining/modelTraining.model';
import { ModelTrainingEntity } from '../src/entities/modelTrainingEntity';
import { DataSetEntity } from '../src/entities/dataSetEntity';
import { ModelEntity } from '../src/entities/modelEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { HardwareMasterEntity } from '../src/entities/hardwareMasterEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { ModelTrainingStatus, DatasetStatus, KAFKAPRODUCERS } from '../src/config';

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

jest.mock('../src/services/infraAvailability/infraAvailabilityService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        checkAvailability: jest.fn().mockResolvedValue({ available: true, freeCount: 4 }),
    })),
}));

jest.mock('../src/services/infraQueue/infraQueueService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        addToQueue: jest.fn().mockResolvedValue({ id: 1 }),
    })),
}));

jest.mock('../src/utils/pricing/pricingService', () => ({
    PricingService: {
        getPricePerSec: jest.fn().mockResolvedValue(0.001),
    },
}));

describe('ModelTrainingService Unit Tests', () => {
    let service: ModelTrainingService;
    let mockKafkaInstance: any;

    beforeEach(() => {
        service = new ModelTrainingService();
        mockKafkaInstance = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return module name "Training"', () => {
            expect(service.getModuleName()).toBe('Training');
        });

        test('should return ModelTrainingModel from getModel', () => {
            const model = service.getModel();
            expect(model).toBeInstanceOf(ModelTrainingModel);
        });

        test('should return DTO class', () => {
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 42 };

            const result = service.transformModel(model);

            expect(result.member_id).toBe(42);
        });

        test('should generate job_id as SHA256 hash (64 chars)', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };

            const result = service.transformModel(model);

            expect(result.job_id).toBeDefined();
            expect(result.job_id.length).toBe(64);
        });

        test('should generate request_id as SHA256 hash (64 chars)', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };

            const result = service.transformModel(model);

            expect(result.request_id).toBeDefined();
            expect(result.request_id.length).toBe(64);
        });

        test('should set status to PENDING', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };

            const result = service.transformModel(model);

            expect(result.status).toBe(ModelTrainingStatus.PENDING);
        });

        test('should set execution_time to 0', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };

            const result = service.transformModel(model);

            expect(result.execution_time).toBe(0);
        });

        test('should extract accelerator_id from infra_detail', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };
            model.infra_detail = { accelerator_id: 5, accelerator_count: 2, cloud_account_id: 3 };

            const result = service.transformModel(model);

            expect(result.accelerator_id).toBe(5);
            expect(result.accelerator_count).toBe(2);
            expect(result.cloud_provider_id).toBe(3);
        });

        test('should not override fields if infra_detail is null', () => {
            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };
            model.accelerator_id = 10;
            model.infra_detail = null;

            const result = service.transformModel(model);

            expect(result.accelerator_id).toBe(10);
        });
    });

    describe('createPreProcess', () => {
        let findOneSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneSpy = jest.fn();
            service.entity = { findOne: findOneSpy } as any;
        });

        test('should reject with E10045 if training with same name exists for company', async () => {
            findOneSpy.mockResolvedValue({ id: 1, name: 'Existing Training' });

            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 1 };
            model.name = 'Existing Training';
            model.company_id = 10;

            await expect(service.createPreProcess(model)).rejects.toBe('E10045');
        });

        test('should transform and resolve model if no duplicate exists', async () => {
            findOneSpy.mockResolvedValue(null);

            const model = new ModelTrainingModel();
            model.decryptToken = { member_id: 42 };
            model.name = 'New Training';
            model.company_id = 10;

            const result = await service.createPreProcess(model);

            expect(result.member_id).toBe(42);
            expect(result.status).toBe(ModelTrainingStatus.PENDING);
        });
    });

    describe('createPostProcess', () => {
        let dataSetFindSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            dataSetFindSpy = jest.spyOn(DataSetEntity, 'findOneBy');
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = { update: entityUpdateSpy, findOneBy: jest.fn() } as any;
        });

        afterEach(() => {
            dataSetFindSpy.mockRestore();
        });

        test('should resolve immediately if no dataset_id', async () => {
            const result = { id: 1, company_id: 10, member_id: 1, name: 'Train1' } as any;
            const model = new ModelTrainingModel();

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            expect(dataSetFindSpy).not.toHaveBeenCalled();
        });

        test('should resolve if dataset not found', async () => {
            dataSetFindSpy.mockResolvedValue(null);

            const result = { id: 1, dataset_id: 99, company_id: 10, member_id: 1, name: 'Train1' } as any;
            const model = new ModelTrainingModel();

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
        });

        test('should mark training as FAILED if dataset has failed status', async () => {
            dataSetFindSpy.mockResolvedValue({
                id: 5,
                status: DatasetStatus.FAILED,
                failure_message: 'Download error',
            });

            const result = {
                id: 1,
                dataset_id: 5,
                company_id: 10,
                member_id: 1,
                name: 'FailTrain',
            } as any;
            const model = new ModelTrainingModel();

            const returned = await service.createPostProcess(result, model, null);

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({ status: ModelTrainingStatus.FAILED })
            );
            expect(returned.status).toBe(ModelTrainingStatus.FAILED);
        });

        test('should initiate training if dataset download_status is true', async () => {
            dataSetFindSpy.mockResolvedValue({
                id: 5,
                status: DatasetStatus.SUCCESS,
                download_status: true,
                yotta_bucket_path: '/data/train.csv',
            });

            const initiateSpy = jest.spyOn(service, 'initiateTraining').mockResolvedValue(undefined);

            const result = {
                id: 1,
                dataset_id: 5,
                company_id: 10,
                member_id: 1,
                name: 'GoodTrain',
            } as any;
            const model = new ModelTrainingModel();

            await service.createPostProcess(result, model, null);

            expect(initiateSpy).toHaveBeenCalledWith(result);
            initiateSpy.mockRestore();
        });
    });

    describe('initiateTraining', () => {
        let dataSetFindSpy: jest.SpyInstance;
        let modelFindSpy: jest.SpyInstance;
        let hardwareSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;

        beforeEach(() => {
            dataSetFindSpy = jest.spyOn(DataSetEntity, 'findOneBy');
            modelFindSpy = jest.spyOn(ModelEntity, 'findOneBy');
            hardwareSpy = jest.spyOn(HardwareMasterEntity, 'findOneBy');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
            service.entity = { update: jest.fn().mockResolvedValue({}) } as any;
        });

        afterEach(() => {
            dataSetFindSpy.mockRestore();
            modelFindSpy.mockRestore();
            hardwareSpy.mockRestore();
            membersSpy.mockRestore();
        });

        test('should return early if dataset not found or not downloaded', async () => {
            dataSetFindSpy.mockResolvedValue(null);

            await service.initiateTraining({ id: 1, dataset_id: 5 } as any);

            expect(mockKafkaInstance.sendMessage).not.toHaveBeenCalled();
        });

        test('should send training payload to Kafka when no accelerator_id', async () => {
            dataSetFindSpy.mockResolvedValue({
                id: 5,
                download_status: true,
                yotta_bucket_path: '/data/train.csv',
            });
            modelFindSpy.mockResolvedValue({ id: 10, name: 'BaseModel' });
            hardwareSpy.mockResolvedValue(null);
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Dev' });

            await service.initiateTraining({
                id: 1,
                dataset_id: 5,
                model_id: 10,
                company_id: 10,
                member_id: 1,
                request_id: 'req123',
                accelerator_id: null,
                accelerator_count: null,
                train_configuration: { lr: 0.001 },
                dataset_configuration: {},
                evaluation_details: null,
            } as any);

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.TRAININGINIT,
                expect.objectContaining({
                    training_id: 1,
                    model_name: 'BaseModel',
                    yotta_bucket_path: '/data/train.csv',
                })
            );
        });

        test('should send to Kafka directly when resources are available', async () => {
            dataSetFindSpy.mockResolvedValue({
                id: 5,
                download_status: true,
                yotta_bucket_path: '/data/train.csv',
            });
            modelFindSpy.mockResolvedValue({ id: 10, name: 'BaseModel' });
            hardwareSpy.mockResolvedValue({ id: 3, model_name: 'A100' });
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Dev' });

            await service.initiateTraining({
                id: 2,
                dataset_id: 5,
                model_id: 10,
                company_id: 10,
                member_id: 1,
                request_id: 'req456',
                accelerator_id: 3,
                accelerator_count: 2,
                cloud_provider_id: 1,
                train_configuration: {},
                dataset_configuration: {},
                evaluation_details: null,
            } as any);

            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.TRAININGINIT,
                expect.objectContaining({
                    training_id: 2,
                    accelerator: 'A100',
                    accelerator_count: 2,
                })
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
            service.entity = {
                findOneBy: findOneBySpy,
                update: entityUpdateSpy,
            } as any;
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
        });

        afterEach(() => {
            membersSpy.mockRestore();
        });

        test('should reject with E10029 if training not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            const model = new ModelTrainingModel();
            model.id = 999;

            await expect(service.updateStatus(model)).rejects.toBe('E10029');
        });

        test('should ignore older status updates (out of order)', async () => {
            findOneBySpy.mockResolvedValue({
                id: 1,
                status: ModelTrainingStatus.TRAINING_STARTED,
                status_log: [],
                company_id: 10,
            });

            const model = new ModelTrainingModel();
            model.id = 1;
            model.status = ModelTrainingStatus.PENDING; // older

            const result = await service.updateStatus(model);

            expect(result).toBe('Ignored older status update');
            expect(entityUpdateSpy).not.toHaveBeenCalled();
        });

        test('should update status and push WebSocket for valid progression', async () => {
            const existing = {
                id: 1,
                status: ModelTrainingStatus.PENDING,
                status_log: [],
                company_id: 10,
                member_id: 5,
                created_at: new Date(Date.now() - 60000),
                name: 'Train1',
            };
            findOneBySpy
                .mockResolvedValueOnce(existing) // first findOneBy
                .mockResolvedValueOnce({ ...existing, status: ModelTrainingStatus.TRAINING_STARTED }); // after update

            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new ModelTrainingModel();
            model.id = 1;
            model.status = ModelTrainingStatus.TRAINING_STARTED;

            const result = await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    status: ModelTrainingStatus.TRAINING_STARTED,
                })
            );
            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith('10', expect.any(Object));
            expect(result).toBe('Model Training Status Updated Successfully');
        });

        test('should calculate execution_time on COMPLETED', async () => {
            const createdAt = new Date(Date.now() - 120000); // 2 min ago
            findOneBySpy
                .mockResolvedValueOnce({
                    id: 1,
                    status: ModelTrainingStatus.TRAINING_STARTED,
                    status_log: [],
                    company_id: 10,
                    member_id: 5,
                    created_at: createdAt,
                    name: 'Train1',
                    accelerator_id: 3,
                })
                .mockResolvedValueOnce({
                    id: 1,
                    status: ModelTrainingStatus.COMPLETED,
                    execution_time: 120,
                    company_id: 10,
                    member_id: 5,
                    name: 'Train1',
                });

            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new ModelTrainingModel();
            model.id = 1;
            model.status = ModelTrainingStatus.COMPLETED;

            await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    status: ModelTrainingStatus.COMPLETED,
                    execution_time: expect.any(Number),
                })
            );
            // Kafka cost message
            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.CREDITCALCULATE,
                expect.objectContaining({ module: 'Training' })
            );
        });

        test('should set execution_time to 0 on FAILED', async () => {
            findOneBySpy
                .mockResolvedValueOnce({
                    id: 1,
                    status: ModelTrainingStatus.TRAINING_STARTED,
                    status_log: [],
                    company_id: 10,
                    member_id: 5,
                    name: 'Train1',
                    created_at: new Date(),
                })
                .mockResolvedValueOnce({
                    id: 1,
                    status: ModelTrainingStatus.FAILED,
                    execution_time: 0,
                    company_id: 10,
                    member_id: 5,
                    name: 'Train1',
                });

            membersSpy.mockResolvedValue({ id: 5, full_name: 'Tester' });

            const model = new ModelTrainingModel();
            model.id = 1;
            model.status = ModelTrainingStatus.FAILED;

            await service.updateStatus(model);

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    status: ModelTrainingStatus.FAILED,
                    execution_time: 0,
                })
            );
        });
    });

    describe('updateDeleteFlagData', () => {
        let mockQB: any;
        let findSpy: jest.SpyInstance;

        beforeEach(() => {
            mockQB = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            findSpy = jest.fn();
            service.entity = {
                find: findSpy,
                createQueryBuilder: jest.fn().mockReturnValue(mockQB),
            } as any;
        });

        test('should soft-delete records and log audit', async () => {
            findSpy.mockResolvedValue([
                { id: 1, company_id: 10, member_id: 5, name: 'Train1' },
            ]);

            const result = await service.updateDeleteFlagData({
                id: 1,
                decryptToken: { member_id: 5 },
            } as any);

            expect(result).toBe(true);
            expect(mockQB.set).toHaveBeenCalledWith({ is_delete: 1 });
        });

        test('should return false if no records found', async () => {
            findSpy.mockResolvedValue(null);

            const result = await service.updateDeleteFlagData({ id: 999 } as any);

            expect(result).toBe(false);
        });

        test('should return false if no id provided', async () => {
            const result = await service.updateDeleteFlagData({} as any);

            expect(result).toBe(false);
        });
    });

    describe('prepareQuery', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, name: 'Train1', status: 'PENDING', profile_picture: null, member_id: 5 },
                ]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;
        });

        test('should build query with company_id filter and return paginated data', async () => {
            const param = { company_id: 10, pageNumber: 1, pageSize: 10 } as any;

            const response = await service.prepareQuery(param);

            expect(service.entity.createQueryBuilder).toHaveBeenCalledWith('model_training');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'model_training.company_id = :company_id',
                { company_id: 10 }
            );
            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply search filter', async () => {
            const param = { company_id: 10, search_text: 'llama' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('LOWER(model_training.name) LIKE :search'),
                { search: '%llama%' }
            );
        });

        test('should apply status filter', async () => {
            const param = { company_id: 10, status: 'COMPLETED' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'UPPER(model_training.status) = :status',
                { status: 'COMPLETED' }
            );
        });

        test('should apply training_type filter', async () => {
            const param = { company_id: 10, training_type: 'Supervised' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'model_training.training_type = :training_type',
                { training_type: 'Supervised' }
            );
        });
    });
});
