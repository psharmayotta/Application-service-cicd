import BenchmarkingService from '../src/services/benchmarking/benchmarkingService.services';
import { BenchmarkingEntity } from '../src/entities/benchmarkingEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { BenchmarkingStatus, BenchmarkingType, ModelBenchmarkingStatus, KAFKAPRODUCERS } from '../src/config';
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

describe('BenchmarkingService Unit Tests', () => {
    let service: BenchmarkingService;
    let mockKafka: any;

    beforeEach(() => {
        service = new BenchmarkingService();
        mockKafka = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Benchmarking" as module name', () => {
            expect(service.getModuleName()).toBe('Benchmarking');
        });

        test('should return model and DTO', () => {
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });

        test('should display model benchmarking creation as Model to Model', () => {
            expect((service as any).getCreationTypeLabel(BenchmarkingType.MODEL)).toBe('Model to Model');
            expect((service as any).getCreationTypeLabel('model_comparison')).toBe('Model to Model');
            expect((service as any).getCreationTypeLabel(BenchmarkingType.HARDWARE)).toBe('Hardware to Hardware');
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = { decryptToken: { member_id: 42 }, benchmarking_type: ' model_comparison ' } as any;
            const result = service.transformModel(model);
            expect(result.member_id).toBe(42);
            expect(result.benchmarking_type).toBe('model_comparison');
        });

        test('should parse inference_setting if string', () => {
            const model = {
                decryptToken: { member_id: 1 },
                inference_setting: '{"temperature":0.7}',
                inference_setting2: null,
                benchmarking_type: 'comparison',
                dataset_id: '[{"id":1,"type":"custom_dataset"}]',
            } as any;
            const result = service.transformModel(model);
            expect(result.inference_setting).toEqual({ temperature: 0.7 });
            expect(result.dataset_id).toEqual([{ id: 1, type: 'custom_dataset' }]);
        });

        test('should handle null/undefined gracefully', () => {
            const model = {
                decryptToken: { member_id: 1 },
                model_path: null,
                model_2_path: '  hf/model  ',
                benchmarking_type: null,
            } as any;
            const result = service.transformModel(model);
            expect(result.model_path).toBeNull();
            expect(result.model_2_path).toBe('hf/model');
        });
    });

    describe('mapToModelStatus (private)', () => {
        const mapStatus = (s: string) => (service as any).mapToModelStatus(s);

        test('should map "completed" to COMPLETED', () => {
            expect(mapStatus('completed')).toBe(ModelBenchmarkingStatus.COMPLETED);
        });

        test('should map "benchmark completed" to COMPLETED', () => {
            expect(mapStatus('benchmark completed')).toBe(ModelBenchmarkingStatus.COMPLETED);
        });

        test('should map "failed" to FAILED', () => {
            expect(mapStatus('failed')).toBe(ModelBenchmarkingStatus.FAILED);
        });

        test('should map "timeout" to FAILED', () => {
            expect(mapStatus('timeout')).toBe(ModelBenchmarkingStatus.FAILED);
        });

        test('should map "verifying model" to VERIFYING_MODEL', () => {
            expect(mapStatus('verifying model')).toBe(ModelBenchmarkingStatus.VERIFYING_MODEL);
        });

        test('should map "model deploy" to MODEL_DEPLOY', () => {
            expect(mapStatus('model deploy')).toBe(ModelBenchmarkingStatus.MODEL_DEPLOY);
        });

        test('should map "dataset verify" to DATASET_VERIFY', () => {
            expect(mapStatus('dataset verify')).toBe(ModelBenchmarkingStatus.DATASET_VERIFY);
        });

        test('should map "benchmarking" to BENCHMARKING', () => {
            expect(mapStatus('benchmarking')).toBe(ModelBenchmarkingStatus.BENCHMARKING);
        });

        test('should default to PENDING for unknown status', () => {
            expect(mapStatus('something_random')).toBe(ModelBenchmarkingStatus.PENDING);
        });
    });

    describe('calculateConsolidatedStatus (private)', () => {
        const calc = (s1: string, s2: string) => (service as any).calculateConsolidatedStatus(s1, s2);

        test('should return FAILED if either model failed', () => {
            expect(calc(ModelBenchmarkingStatus.FAILED, ModelBenchmarkingStatus.COMPLETED)).toBe(ModelBenchmarkingStatus.FAILED);
            expect(calc(ModelBenchmarkingStatus.COMPLETED, ModelBenchmarkingStatus.FAILED)).toBe(ModelBenchmarkingStatus.FAILED);
        });

        test('should return bottleneck (minimum progress) status', () => {
            expect(calc(ModelBenchmarkingStatus.BENCHMARKING, ModelBenchmarkingStatus.COMPLETED)).toBe(ModelBenchmarkingStatus.BENCHMARKING);
            expect(calc(ModelBenchmarkingStatus.PENDING, ModelBenchmarkingStatus.BENCHMARKING)).toBe(ModelBenchmarkingStatus.PENDING);
        });

        test('should return COMPLETED when both are COMPLETED', () => {
            expect(calc(ModelBenchmarkingStatus.COMPLETED, ModelBenchmarkingStatus.COMPLETED)).toBe(ModelBenchmarkingStatus.COMPLETED);
        });
    });

    describe('updateBenchmarkingStatus', () => {
        let findOneBySpy: jest.SpyInstance;
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            updateSpy = jest.fn().mockResolvedValue({});
            service.entity = { findOneBy: findOneBySpy, update: updateSpy } as any;
        });

        test('should reject if record not found', async () => {
            findOneBySpy.mockResolvedValue(null);
            await expect(service.updateBenchmarkingStatus({ benchmark_id: 999, status: 'running' })).rejects.toBe('Benchmarking record not found');
        });

        test('should update model_1_status for modelId=1', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, company_id: 10, model_1_status: 'PENDING', model_2_status: 'PENDING', status: 'PENDING', member_id: 5, name: 'BM1' })
                .mockResolvedValueOnce({ id: 1, status: ModelBenchmarkingStatus.VERIFYING_MODEL });

            await service.updateBenchmarkingStatus({ benchmark_id: 1, benchmark_model_id: 1, status: 'verifying model' });

            expect(updateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({ model_1_status: ModelBenchmarkingStatus.VERIFYING_MODEL })
            );
            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalled();
        });

        test('should update model_2_status for modelId=2', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, company_id: 10, model_1_status: 'COMPLETED', model_2_status: 'PENDING', status: 'PENDING', member_id: 5, name: 'BM1' })
                .mockResolvedValueOnce({ id: 1, status: ModelBenchmarkingStatus.COMPLETED });

            await service.updateBenchmarkingStatus({ benchmark_id: 1, benchmark_model_id: 2, status: 'completed' });

            expect(updateSpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({ model_2_status: ModelBenchmarkingStatus.COMPLETED })
            );
            expect(AuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
                entity_id: 1,
                metadata: expect.objectContaining({ completion_source: 'status' }),
            }));
        });

        test('should not duplicate the COMPLETED audit for repeated completion updates', async () => {
            findOneBySpy
                .mockResolvedValueOnce({ id: 1, company_id: 10, model_1_status: 'COMPLETED', model_2_status: 'COMPLETED', status: ModelBenchmarkingStatus.COMPLETED, member_id: 5, name: 'BM1' })
                .mockResolvedValueOnce({ id: 1, status: ModelBenchmarkingStatus.COMPLETED });

            await service.updateBenchmarkingStatus({ benchmark_id: 1, benchmark_model_id: 2, status: 'completed' });

            expect(AuditLogService.log).not.toHaveBeenCalledWith(expect.objectContaining({
                action: 'COMPLETED',
            }));
        });
    });

    describe('updateResult audit logging', () => {
        test('should leave completion auditing to the status callback', async () => {
            const findOneBy = jest.fn()
                .mockResolvedValueOnce({
                    id: 1,
                    company_id: 10,
                    member_id: 5,
                    name: 'BM1',
                    benchmarking_type: BenchmarkingType.MODEL,
                    model_1_status: ModelBenchmarkingStatus.COMPLETED,
                    model_2_status: ModelBenchmarkingStatus.PENDING,
                    status: ModelBenchmarkingStatus.PENDING,
                    created_at: new Date(),
                })
                .mockResolvedValueOnce({
                    id: 1,
                    status: ModelBenchmarkingStatus.COMPLETED,
                });
            service.entity = {
                findOneBy,
                update: jest.fn().mockResolvedValue({}),
            } as any;

            await service.updateResult({
                benchmark_id: 1,
                benchmark_model_id: 2,
                results: { datasets: [] },
            });

            expect(AuditLogService.log).not.toHaveBeenCalledWith(
                expect.objectContaining({ action: 'COMPLETED' })
            );
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
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([{ id: 1, name: 'BM1', profile_picture: null }]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = { createQueryBuilder: jest.fn().mockReturnValue(mockQB) } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should return paginated data', async () => {
            const response = await service.prepareQuery({ company_id: 10, pageNumber: 1, pageSize: 10 } as any);
            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply search filter', async () => {
            await service.prepareQuery({ company_id: 10, search_text: 'test' } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'benchmarking.name ILIKE :searchText',
                { searchText: '%test%' }
            );
        });

        test('should apply type filter', async () => {
            await service.prepareQuery({ company_id: 10, type: BenchmarkingType.MODEL } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'benchmarking.benchmarking_type = :type',
                { type: BenchmarkingType.MODEL }
            );
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

        test('should soft-delete and return true', async () => {
            findSpy.mockResolvedValue([{ id: 1, company_id: 10, member_id: 5, name: 'BM1' }]);
            const result = await service.updateDeleteFlagData({ id: 1, decryptToken: { member_id: 5 } } as any);
            expect(result).toBe(true);
        });

        test('should return false if no records', async () => {
            findSpy.mockResolvedValue(null);
            const result = await service.updateDeleteFlagData({ id: 999 } as any);
            expect(result).toBe(false);
        });
    });
});
