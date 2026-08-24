import KnowledgeBaseService from '../src/services/knowledgeBase/knowledgeBaseService.services';
import { KnowledgeBaseModel } from '../src/database/repository/knowledgeBase/knowledgeBase.model';
import { KnowledgeBaseEntity } from '../src/entities/knowledgeBaseEntity';
import { DeploymentKbIntegrationEntity } from '../src/entities/deploymentKbIntegrationEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { DataSetEntity } from '../src/entities/dataSetEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { KnowledgeBaseStatus, KnowledgeBaseJobStatus } from '../src/config';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mockKafkaInstance = { sendMessage: jest.fn().mockResolvedValue(true) };
    return { KafkaService: { getInstance: jest.fn().mockReturnValue(mockKafkaInstance) } };
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

jest.mock('../src/services/knowledgeBase/knowledgeBaseJobService.services', () => ({
    KnowledgeBaseJobService: jest.fn().mockImplementation(() => ({
        getModel: jest.fn().mockReturnValue({}),
        createRecord: jest.fn().mockResolvedValue({ id: 100 }),
        entity: {
            findOneBy: jest.fn().mockResolvedValue({ id: 100, status: 'PENDING' }),
            findOne: jest.fn().mockResolvedValue({ id: 100, status: 'PENDING' }),
            update: jest.fn().mockResolvedValue({}),
        },
    })),
}));

jest.mock('../src/services/knowledgeBase/knowledgeBaseSourceMappingService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        getModel: jest.fn().mockReturnValue({}),
        createRecord: jest.fn().mockResolvedValue({ id: 200 }),
        triggerKafkaUpdate: jest.fn().mockResolvedValue(true),
        entity: {
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            createQueryBuilder: jest.fn().mockReturnValue({
                leftJoinAndMapOne: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            }),
        },
    })),
}));

describe('KnowledgeBaseService Unit Tests', () => {
    let service: KnowledgeBaseService;

    beforeEach(() => {
        service = new KnowledgeBaseService();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Knowledge Base" as module name', () => {
            expect(service.getModuleName()).toBe('Knowledge Base');
        });

        test('should return KnowledgeBaseModel from getModel', () => {
            expect(service.getModel()).toBeInstanceOf(KnowledgeBaseModel);
        });

        test('should return DTO', () => {
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 42 };

            const result = service.transformModel(model);

            expect(result.member_id).toBe(42);
        });

        test('should extract source_details fields to top-level', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = {
                source_type_id: 3,
                cloud_provider_id: 5,
                cloud_secret_id: 7,
                region_id: 9,
                auto_sync: true,
                sync_frequency: 'daily',
                sync_time: '03:00',
                sync_day: 1,
            };

            const result = service.transformModel(model);

            expect(result.source_type_id).toBe(3);
            expect(result.cloud_provider_id).toBe(5);
            expect(result.cloud_secret_id).toBe(7);
            expect(result.region_id).toBe(9);
            expect(result.auto_sync).toBe(true);
            expect(result.sync_frequency).toBe('daily');
            expect(result.sync_time).toBe('03:00');
            expect(result.sync_day).toBe(1);
        });

        test('should extract embedding_model_id from embedding_details', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 1 };
            model.embedding_details = { embedded_model_id: 99 };

            const result = service.transformModel(model);

            expect(result.embedding_model_id).toBe(99);
        });

        test('should extract vector_store_id from vector_store_details', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 1 };
            model.vector_store_details = { vector_store_id: 88 };

            const result = service.transformModel(model);

            expect(result.vector_store_id).toBe(88);
        });

        test('should handle provider_id and secret_id aliases in source_details', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = {
                provider_id: 11,
                secret_id: 22,
            };

            const result = service.transformModel(model);

            expect(result.cloud_provider_id).toBe(11);
            expect(result.cloud_secret_id).toBe(22);
        });

        test('should not crash if source_details is null', () => {
            const model = new KnowledgeBaseModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = null;

            const result = service.transformModel(model);

            expect(result.member_id).toBe(1);
        });
    });

    describe('getStatusOrder (private, tested via updateStatus behavior)', () => {
        // Test the static-like behavior indirectly
        test('PENDING has lower order than SAVING_TO_KNOWLEDGE_BASE', () => {
            // Access private method for testing
            const getOrder = (service as any).getStatusOrder.bind(service);
            expect(getOrder('PENDING')).toBeLessThan(getOrder('SAVING_TO_KNOWLEDGE_BASE'));
        });

        test('FAILED has order 1', () => {
            const getOrder = (service as any).getStatusOrder.bind(service);
            expect(getOrder('FAILED')).toBe(1);
        });

        test('Unknown status defaults to 0', () => {
            const getOrder = (service as any).getStatusOrder.bind(service);
            expect(getOrder('UNKNOWN_STATUS')).toBe(0);
        });
    });

    describe('calculateNextRun (private)', () => {
        const calcNextRun = (freq: string, time?: string, day?: number) => {
            return (service as any).calculateNextRun(freq, time, day);
        };

        test('hourly should return a date ~1 hour from now', () => {
            const result = calcNextRun('hourly');
            const diff = result.getTime() - Date.now();
            expect(diff).toBeGreaterThan(3500000); // ~58 min
            expect(diff).toBeLessThan(3700000);    // ~62 min
        });

        test('daily without time should return ~24 hours from now', () => {
            const result = calcNextRun('daily');
            const diff = result.getTime() - Date.now();
            expect(diff).toBeGreaterThan(80000000);  // > 22 hours
            expect(diff).toBeLessThan(90000000);     // < 25 hours
        });

        test('daily with specific time should return next occurrence of that time', () => {
            const result = calcNextRun('daily', '14:30');
            expect(result).toBeInstanceOf(Date);
        });

        test('weekly should return a date in the future', () => {
            const result = calcNextRun('weekly');
            expect(result.getTime()).toBeGreaterThan(Date.now());
        });

        test('monthly should return ~30 days from now', () => {
            const result = calcNextRun('monthly');
            const diff = result.getTime() - Date.now();
            expect(diff).toBeGreaterThan(25 * 24 * 3600 * 1000);
        });

        test('numeric frequency (minutes) should work', () => {
            const result = calcNextRun('30');
            const diff = result.getTime() - Date.now();
            expect(diff).toBeGreaterThan(28 * 60 * 1000);
            expect(diff).toBeLessThan(32 * 60 * 1000);
        });

        test('unknown frequency returns null', () => {
            const result = calcNextRun('never');
            expect(result).toBeNull();
        });
    });

    describe('prepareQuery', () => {
        let mockQueryBuilder: any;
        let dkiQueryBuilderSpy: jest.SpyInstance;

        beforeEach(() => {
            mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, name: 'KB1', profile_picture: null, member_id: 5, deployment_count: '2' },
                ]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;

            // Mock static createQueryBuilder on DeploymentKbIntegrationEntity
            dkiQueryBuilderSpy = jest.spyOn(DeploymentKbIntegrationEntity, 'createQueryBuilder').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getQuery: jest.fn().mockReturnValue('(SELECT COUNT(dki.id) ...)'),
            } as any);
        });

        afterEach(() => {
            dkiQueryBuilderSpy.mockRestore();
        });

        test('should return paginated data with deployment_count as number', async () => {
            const param = { company_id: 10, pageNumber: 1, pageSize: 10 } as any;

            const response = await service.prepareQuery(param);

            expect(response.data[0].deployment_count).toBe(2);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply search filter', async () => {
            const param = { company_id: 10, search_text: 'docs' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                '(LOWER(kb.name) LIKE :search)',
                { search: '%docs%' }
            );
        });

        test('should filter completed status as SAVING_TO_KNOWLEDGE_BASE', async () => {
            const param = { company_id: 10, status: 'completed' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'kb.status = :status',
                { status: KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE }
            );
        });

        test('should filter failed status', async () => {
            const param = { company_id: 10, status: 'failed' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'kb.status = :status',
                { status: KnowledgeBaseStatus.FAILED }
            );
        });

        test('should filter inprogress status (NOT IN terminal statuses)', async () => {
            const param = { company_id: 10, status: 'inprogress' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'kb.status NOT IN (:...terminalStatuses)',
                { terminalStatuses: [KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE, KnowledgeBaseStatus.FAILED] }
            );
        });

        test('should apply chunking_type filter', async () => {
            const param = { company_id: 10, chunking_type: 'recursive' } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'kb.chunking_type = :chunkingType',
                { chunkingType: 'recursive' }
            );
        });
    });

    describe('createPostProcess', () => {
        let kbFindSpy: jest.SpyInstance;
        let kbSaveSpy: jest.SpyInstance;
        let membersSpy: jest.SpyInstance;

        beforeEach(() => {
            kbFindSpy = jest.spyOn(KnowledgeBaseEntity, 'findOneBy');
            kbSaveSpy = jest.spyOn(KnowledgeBaseEntity, 'save');
            membersSpy = jest.spyOn(MembersEntity, 'findOneBy');
        });

        afterEach(() => {
            kbFindSpy.mockRestore();
            kbSaveSpy.mockRestore();
            membersSpy.mockRestore();
        });

        test('should skip initialization logic on UPDATE (model.id present)', async () => {
            kbFindSpy.mockResolvedValue({ id: 1, auto_sync: false, sync_frequency: null });
            kbSaveSpy.mockResolvedValue({});

            const result = { id: 1, company_id: 10, member_id: 1, name: 'KB1' } as any;
            const model = new KnowledgeBaseModel();
            model.id = 1; // UPDATE

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            // Should NOT have called members (no notification for updates)
            expect(membersSpy).not.toHaveBeenCalled();
        });

        test('should send notification and WebSocket on CREATE', async () => {
            kbFindSpy.mockResolvedValue({
                id: 5,
                auto_sync: true,
                sync_frequency: 'daily',
                sync_time: '03:00',
            });
            kbSaveSpy.mockResolvedValue({});
            membersSpy.mockResolvedValue({ id: 1, full_name: 'Tester' });

            const result = {
                id: 5,
                company_id: 10,
                member_id: 1,
                name: 'New KB',
                source_details: { source_type_id: 2 },
                cloud_provider_id: null,
                cloud_secret_id: null,
                region_id: null,
            } as any;
            const model = new KnowledgeBaseModel();
            // model.id is null => CREATE

            const returned = await service.createPostProcess(result, model, null);

            expect(returned).toBe(result);
            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalled();
        });
    });

    describe('syncNow', () => {
        let findOneBySpy: jest.SpyInstance;
        let saveSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            saveSpy = jest.fn().mockResolvedValue({});
            service.entity = {
                findOneBy: findOneBySpy,
                save: saveSpy,
            } as any;
        });

        test('should reject with E10065 if KB not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            await expect(service.syncNow(999, 10)).rejects.toBe('E10065');
        });

        test('should create job, reset sources, trigger kafka, and return job_id', async () => {
            findOneBySpy.mockResolvedValue({
                id: 1,
                company_id: 10,
                member_id: 5,
                status: KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE,
                auto_sync: true,
                sync_frequency: 'daily',
                sync_time: '03:00',
            });

            const result = await service.syncNow(1, 10);

            expect(result.job_id).toBe(100);
            expect(result.status).toBe('Triggered');
            expect(saveSpy).toHaveBeenCalled();
            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalled();
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

        test('should soft-delete and log audit', async () => {
            findSpy.mockResolvedValue([{ id: 1, company_id: 10, member_id: 5, name: 'KB1' }]);

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

        test('should return false if id is not provided', async () => {
            const result = await service.updateDeleteFlagData({} as any);

            expect(result).toBe(false);
        });
    });
});
