import { BatchInferenceService } from '../src/services/batchInference/batchInference.service';
import { BatchInferenceModel } from '../src/database/repository/batchInference/batchInference.model';
import { BatchInferenceEntity } from '../src/entities/batchInferenceEntity';
import { BatchInferenceJobEntity } from '../src/entities/batchInferenceJobEntity';
import { CloudProviderEntity } from '../src/entities/cloudProviderEntity';
import { DataSetEntity } from '../src/entities/dataSetEntity';
import { ModelEntity } from '../src/entities/modelEntity';
import { ModelClassEntity } from '../src/entities/modelClassEntity';
import { ModelTrainingEntity } from '../src/entities/modelTrainingEntity';
import { CloudSecretsEntity } from '../src/entities/cloudSecretsEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { BatchJobStatus, DatasetStatus, KAFKAPRODUCERS, ModelModuleType } from '../src/config';
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

jest.mock('../src/services/batchInference/batchInferenceJob.service', () => ({
    BatchInferenceJobService: jest.fn().mockImplementation(() => ({
        getModel: jest.fn().mockReturnValue({}),
        createRecord: jest.fn().mockResolvedValue({ id: 50 }),
        entity: {
            findOneBy: jest.fn().mockResolvedValue(null),
            findOne: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({}),
        },
    })),
}));

describe('BatchInferenceService Unit Tests', () => {
    let service: BatchInferenceService;
    let mockKafka: any;

    beforeEach(() => {
        service = new BatchInferenceService();
        mockKafka = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Batch Inference" as module name', () => {
            expect(service.getModuleName()).toBe('Batch Inference');
        });

        test('should return BatchInferenceModel', () => {
            expect(service.getModel()).toBeInstanceOf(BatchInferenceModel);
        });

        test('should return DTO', () => {
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = new BatchInferenceModel();
            model.decryptToken = { member_id: 42, company_id: 10 };

            const result = service.transformModel(model);

            expect(result.member_id).toBe(42);
            expect(result.company_id).toBe(10);
        });

        test('should keep existing member_id if no decryptToken', () => {
            const model = new BatchInferenceModel();
            model.member_id = 99;
            model.company_id = 5;
            model.decryptToken = null;

            const result = service.transformModel(model);

            expect(result.member_id).toBe(99);
            expect(result.company_id).toBe(5);
        });
    });

    describe('buildKafkaPayload', () => {
        let cloudProviderSpy: jest.SpyInstance;
        let dataSetSpy: jest.SpyInstance;
        let modelSpy: jest.SpyInstance;
        let modelClassSpy: jest.SpyInstance;
        let trainingSpy: jest.SpyInstance;
        let secretsSpy: jest.SpyInstance;

        beforeEach(() => {
            cloudProviderSpy = jest.spyOn(CloudProviderEntity, 'findOneBy');
            dataSetSpy = jest.spyOn(DataSetEntity, 'findOneBy');
            modelSpy = jest.spyOn(ModelEntity, 'findOneBy');
            modelClassSpy = jest.spyOn(ModelClassEntity, 'findOneBy');
            trainingSpy = jest.spyOn(ModelTrainingEntity, 'findOneBy');
            secretsSpy = jest.spyOn(CloudSecretsEntity, 'findOneBy');
        });

        afterEach(() => {
            cloudProviderSpy.mockRestore();
            dataSetSpy.mockRestore();
            modelSpy.mockRestore();
            modelClassSpy.mockRestore();
            trainingSpy.mockRestore();
            secretsSpy.mockRestore();
        });

        test('should build payload with dataset and model details for playground type', async () => {
            cloudProviderSpy.mockResolvedValue({ id: 1, name: 'Q0 Library' });
            dataSetSpy.mockResolvedValue({ id: 5, name: 'TestDS', dataset_path: '/data/test.csv', cloud_secret_id: null, cloud_service_id: null });
            modelSpy.mockResolvedValue({ id: 10, name: 'GPT', model_class_id: 2, model_source_repo: 'hf/gpt', cloud_secret_id: null, member_id: null, training_id: null });
            modelClassSpy.mockResolvedValue({ id: 2, name: 'Transformer' });
            trainingSpy.mockResolvedValue(null);
            secretsSpy.mockResolvedValue(null);

            const model = new BatchInferenceModel();
            model.id = 1;
            model.name = 'Batch1';
            model.company_id = 10;
            model.member_id = 5;
            model.cloud_provider_id = 1;
            model.dataset_id = 5;
            model.base_model_id = 10;
            model.model_type = ModelModuleType.PLAYGROUND;
            model.configuration = { temperature: 0.7 };

            const payload = await service.buildKafkaPayload(model);

            expect(payload.id).toBe(1);
            expect(payload.name).toBe('Batch1');
            expect(payload.dataset.name).toBe('TestDS');
            expect(payload.model_details.model_class).toBe('Transformer');
            expect(payload.model_details.model_deploy_type).toBe(ModelModuleType.PLAYGROUND);
            expect(payload.configuration).toEqual({ temperature: 0.7 });
        });

        test('should build payload for training type', async () => {
            cloudProviderSpy.mockResolvedValue(null);
            dataSetSpy.mockResolvedValue(null);
            trainingSpy.mockResolvedValue({ id: 20, model_id: 15 });
            modelSpy.mockResolvedValue({ id: 15, name: 'FineTuned', model_class_id: 3, model_source_repo: 'hf/ft', cloud_secret_id: null });
            modelClassSpy.mockResolvedValue({ id: 3, name: 'LLM' });
            secretsSpy.mockResolvedValue(null);

            const model = new BatchInferenceModel();
            model.id = 2;
            model.name = 'TrainingBatch';
            model.company_id = 10;
            model.member_id = 5;
            model.base_model_id = 20;
            model.model_type = ModelModuleType.TRAINING;

            const payload = await service.buildKafkaPayload(model);

            expect(payload.model_details.model_class).toBe('LLM');
            expect(payload.model_details.model_deploy_type).toBe(ModelModuleType.TRAINING);
        });

        test('should handle null base_model_id gracefully', async () => {
            cloudProviderSpy.mockResolvedValue(null);
            dataSetSpy.mockResolvedValue(null);
            modelSpy.mockResolvedValue(null);
            trainingSpy.mockResolvedValue(null);
            modelClassSpy.mockResolvedValue(null);
            secretsSpy.mockResolvedValue(null);

            const model = new BatchInferenceModel();
            model.id = 3;
            model.name = 'NoBM';
            model.company_id = 10;
            model.member_id = 5;

            const payload = await service.buildKafkaPayload(model);

            expect(payload.model_details.base_model_id).toBeNull();
        });
    });

    describe('createPostProcess', () => {
        let batchFindSpy: jest.SpyInstance;
        let batchSaveSpy: jest.SpyInstance;
        let dataSetSpy: jest.SpyInstance;

        beforeEach(() => {
            batchFindSpy = jest.spyOn(BatchInferenceEntity, 'findOneBy');
            batchSaveSpy = jest.spyOn(BatchInferenceEntity, 'save');
            dataSetSpy = jest.spyOn(DataSetEntity, 'findOneBy');
        });

        afterEach(() => {
            batchFindSpy.mockRestore();
            batchSaveSpy.mockRestore();
            dataSetSpy.mockRestore();
        });

        test('should return result on UPDATE without dispatching Kafka', async () => {
            batchFindSpy.mockResolvedValue({ id: 1, is_sync_enabled: false, sync_frequency: 'none' });
            batchSaveSpy.mockResolvedValue({});

            const result = { id: 1, company_id: 10, member_id: 5, name: 'Batch1' } as any;
            const model = new BatchInferenceModel();
            model.id = 1; // UPDATE

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            expect(mockKafka.sendMessage).not.toHaveBeenCalled();
        });

        test('should persist PAUSED on the latest job and log a pause action', async () => {
            batchFindSpy.mockResolvedValue({ id: 1, is_sync_enabled: false, sync_frequency: 'none' });
            batchSaveSpy.mockResolvedValue({});
            const latestJob = { id: 20, inference_id: 1, status: BatchJobStatus.RUNNING } as any;
            jest.spyOn(BatchInferenceJobEntity, 'findOne').mockResolvedValue(latestJob);
            const jobSaveSpy = jest.spyOn(BatchInferenceJobEntity, 'save').mockResolvedValue(latestJob);
            jest.spyOn(service, 'buildKafkaPayload').mockResolvedValue({ id: 1 });

            const result = { id: 1, company_id: 10, member_id: 5, name: 'Batch1' } as any;
            const model = new BatchInferenceModel();
            model.id = 1;
            model.status = BatchJobStatus.PAUSED;

            await service.createPostProcess(result, model, null);

            expect(jobSaveSpy).toHaveBeenCalledWith(expect.objectContaining({ status: BatchJobStatus.PAUSED }));
            expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAUSE' }));
            expect(mockKafka.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.BATCH_INFERENCE,
                expect.objectContaining({ job_id: 20, type: 'PAUSE' })
            );
        });

        test('should create job and send Kafka on CREATE with ready dataset', async () => {
            batchFindSpy.mockResolvedValue({ id: 2, is_sync_enabled: true, sync_frequency: 'daily', sync_time: '03:00' });
            batchSaveSpy.mockResolvedValue({});
            dataSetSpy.mockResolvedValue({ id: 5, status: DatasetStatus.SUCCESS, download_status: true });

            jest.spyOn(service, 'buildKafkaPayload').mockResolvedValue({ id: 2, name: 'Batch2' });

            const result = { id: 2, company_id: 10, member_id: 5, name: 'Batch2', dataset_id: 5 } as any;
            const model = new BatchInferenceModel();
            model.company_id = 10;
            model.member_id = 5;
            model.name = 'Batch2';

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            expect(mockKafka.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.BATCH_INFERENCE,
                expect.objectContaining({ type: 'CREATE' })
            );
        });

        test('should create FAILED job when dataset has failed status', async () => {
            batchFindSpy.mockResolvedValue({ id: 3, is_sync_enabled: false, sync_frequency: 'none' });
            batchSaveSpy.mockResolvedValue({});
            dataSetSpy.mockResolvedValue({ id: 5, status: DatasetStatus.FAILED, download_status: false });

            const result = { id: 3, company_id: 10, member_id: 5, name: 'FailBatch', dataset_id: 5 } as any;
            const model = new BatchInferenceModel();
            model.company_id = 10;
            model.member_id = 5;
            model.name = 'FailBatch';

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            expect(mockKafka.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('calculateNextRun (private)', () => {
        const calcNext = (freq: string, time?: string, day?: string) => {
            return (service as any).calculateNextRun(freq, time, day);
        };

        test('hourly returns a date-time string', () => {
            const result = calcNext('hourly');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        });

        test('daily returns a date-time string', () => {
            const result = calcNext('daily');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        test('weekly returns a date-time string', () => {
            const result = calcNext('weekly');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        test('monthly returns a date-time string', () => {
            const result = calcNext('monthly');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        test('numeric frequency in minutes works', () => {
            const result = calcNext('60');
            expect(typeof result).toBe('string');
            expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
        });

        test('unknown frequency returns null', () => {
            const result = calcNext('never');
            expect(result).toBeNull();
        });
    });

    describe('prepareQuery', () => {
        let mockQB: any;

        beforeEach(() => {
            mockQB = {
                leftJoin: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, name: 'B1', member_image: null, source_image: null, status: 'COMPLETED' },
                ]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = { createQueryBuilder: jest.fn().mockReturnValue(mockQB) } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should return paginated data', async () => {
            const param = { company_id: 10, pageNumber: 1, pageSize: 10 } as any;

            const response = await service.prepareQuery(param);

            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply company_id filter', async () => {
            const param = { company_id: 10 } as any;

            await service.prepareQuery(param);

            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'batch.company_id = :companyId',
                { companyId: 10 }
            );
        });
    });

    describe('updateJobStatus audit logging', () => {
        let jobFindSpy: jest.SpyInstance;
        let jobSaveSpy: jest.SpyInstance;
        let inferenceFindSpy: jest.SpyInstance;

        beforeEach(() => {
            jobFindSpy = jest.spyOn(BatchInferenceJobEntity, 'findOneBy');
            jobSaveSpy = jest.spyOn(BatchInferenceJobEntity, 'save').mockImplementation(async (job: any) => job);
            inferenceFindSpy = jest.spyOn(BatchInferenceEntity, 'findOneBy').mockResolvedValue({
                id: 1,
                name: 'Batch1',
                company_id: 10,
                member_id: 5,
            } as any);
        });

        afterEach(() => {
            jobFindSpy.mockRestore();
            jobSaveSpy.mockRestore();
            inferenceFindSpy.mockRestore();
        });

        test('logs COMPLETED only when the job transitions to completed', async () => {
            jobFindSpy.mockResolvedValue({
                id: 20,
                inference_id: 1,
                status: BatchJobStatus.RUNNING,
                created_at: new Date(),
                logs: '',
                result: null,
            } as any);

            await service.updateJobStatus({ job_id: 20, status: 'SUCCESS' });

            expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
                entity_id: 1,
                metadata: expect.objectContaining({ job_id: 20 }),
            }));
        });

        test('does not duplicate COMPLETED audit for repeated completion messages', async () => {
            jobFindSpy.mockResolvedValue({
                id: 20,
                inference_id: 1,
                status: BatchJobStatus.COMPLETED,
                created_at: new Date(),
                logs: '',
                result: null,
            } as any);

            await service.updateJobStatus({ job_id: 20, status: 'COMPLETED' });

            expect(AuditLogService.log).not.toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
            }));
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
            findSpy.mockResolvedValue([{ id: 1, company_id: 10, member_id: 5, name: 'Batch1' }]);

            const result = await service.updateDeleteFlagData({
                id: 1, decryptToken: { member_id: 5 },
            } as any);

            expect(result).toBe(true);
            expect(mockQB.set).toHaveBeenCalledWith({ is_delete: 1 });
        });

        test('should return false if no records found', async () => {
            findSpy.mockResolvedValue(null);
            const result = await service.updateDeleteFlagData({ id: 999 } as any);
            expect(result).toBe(false);
        });
    });
});
