import KnowledgeBaseSourceMappingService from '../src/services/knowledgeBase/knowledgeBaseSourceMappingService.services';
import { KnowledgeBaseSourceMappingModel } from '../src/database/repository/knowledgeBaseSourceMapping/knowledgeBaseSourceMapping.model';
import { KnowledgeBaseEntity } from '../src/entities/knowledgeBaseEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { KAFKAPRODUCERS } from '../src/config';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mock = { sendMessage: jest.fn().mockResolvedValue(true) };
    return { KafkaService: { getInstance: jest.fn().mockReturnValue(mock) } };
});

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
            findOneBy: jest.fn().mockResolvedValue({ id: 100 }),
            findOne: jest.fn().mockResolvedValue({ id: 100 }),
            update: jest.fn().mockResolvedValue({}),
            createQueryBuilder: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({ id: 100 }),
            }),
        },
    })),
}));

jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ status: 200 }) }));

describe('KnowledgeBaseSourceMappingService Unit Tests', () => {
    let service: KnowledgeBaseSourceMappingService;
    let mockKafka: any;

    beforeEach(() => {
        service = new KnowledgeBaseSourceMappingService();
        mockKafka = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Knowledge Base" as module name', () => {
            expect(service.getModuleName()).toBe('Knowledge Base');
        });

        test('should return model and DTO', () => {
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = new KnowledgeBaseSourceMappingModel();
            model.decryptToken = { member_id: 42 };
            const result = service.transformModel(model);
            expect(result.member_id).toBe(42);
        });

        test('should extract cloud IDs from source_details', () => {
            const model = new KnowledgeBaseSourceMappingModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = {
                cloud_provider_id: 5,
                cloud_secret_id: 7,
                region_id: 9,
                bucket_path: '  /data/bucket  ',
            };

            const result = service.transformModel(model);

            expect(result.cloud_provider_id).toBe(5);
            expect(result.cloud_secret_id).toBe(7);
            expect(result.region_id).toBe(9);
            expect(result.source_details.bucket_path).toBe('/data/bucket'); // trimmed
        });

        test('should handle provider_id and secret_id aliases', () => {
            const model = new KnowledgeBaseSourceMappingModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = { provider_id: 11, secret_id: 22 };

            const result = service.transformModel(model);

            expect(result.cloud_provider_id).toBe(11);
            expect(result.cloud_secret_id).toBe(22);
        });

        test('should not crash if source_details is null', () => {
            const model = new KnowledgeBaseSourceMappingModel();
            model.decryptToken = { member_id: 1 };
            model.source_details = null;

            const result = service.transformModel(model);
            expect(result.member_id).toBe(1);
        });
    });

    describe('prepareQuery', () => {
        let mockQB: any;

        beforeEach(() => {
            mockQB = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, knowledge_base_id: 10, source_type_icon: null, cloud_provider_image: null, profile_image: null },
                ]),
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQB),
                count: jest.fn().mockResolvedValue(1),
            } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should return paginated data', async () => {
            const response = await service.prepareQuery({ knowledge_base_id: 10, pageNumber: 1, pageSize: 10 });
            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply knowledge_base_id filter', async () => {
            await service.prepareQuery({ knowledge_base_id: 10 });
            expect(mockQB.andWhere).toHaveBeenCalledWith('sourceMapping.knowledge_base_id = :kbId', { kbId: 10 });
        });

        test('should apply status filter', async () => {
            await service.prepareQuery({ knowledge_base_id: 10, status: 'active' });
            expect(mockQB.andWhere).toHaveBeenCalledWith('sourceMapping.status = :status', { status: 'active' });
        });

        test('should apply is_delete default of 0', async () => {
            await service.prepareQuery({ knowledge_base_id: 10 });
            expect(mockQB.andWhere).toHaveBeenCalledWith('sourceMapping.is_delete = :isDelete', { isDelete: 0 });
        });
    });

    describe('triggerKafkaUpdate', () => {
        test('should build payload and send to RAGINIT topic', async () => {
            jest.spyOn(service, 'buildKafkaPayload').mockResolvedValue({
                knowledge_base_id: 1, org_id: 10, source_details: [],
            });

            await service.triggerKafkaUpdate(1, 100, 200, true);

            expect(mockKafka.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.RAGINIT,
                expect.objectContaining({ knowledge_base_id: 1 })
            );
        });

        test('should reject if buildKafkaPayload fails', async () => {
            jest.spyOn(service, 'buildKafkaPayload').mockRejectedValue(new Error('Build failed'));

            await expect(service.triggerKafkaUpdate(1)).rejects.toThrow('Build failed');
        });
    });

    describe('syncNow', () => {
        let entityFindSpy: jest.SpyInstance;
        let kbFindSpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindSpy = jest.fn();
            service.entity = { findOneBy: entityFindSpy } as any;
            kbFindSpy = jest.spyOn(KnowledgeBaseEntity, 'findOneBy');
        });

        afterEach(() => {
            kbFindSpy.mockRestore();
        });

        test('should throw if source mapping not found', async () => {
            entityFindSpy.mockResolvedValue(null);
            await expect(service.syncNow(999)).rejects.toThrow('Source mapping not found');
        });

        test('should throw if knowledge base not found', async () => {
            entityFindSpy.mockResolvedValue({ id: 1, knowledge_base_id: 10 });
            kbFindSpy.mockResolvedValue(null);
            await expect(service.syncNow(1)).rejects.toThrow('Knowledge base not found');
        });

        test('should create job and trigger Kafka update', async () => {
            entityFindSpy.mockResolvedValue({ id: 1, knowledge_base_id: 10 });
            kbFindSpy.mockResolvedValue({ id: 10, company_id: 5 });
            jest.spyOn(service, 'triggerKafkaUpdate').mockResolvedValue(true);

            await service.syncNow(1);

            expect((service as any).triggerKafkaUpdate).toHaveBeenCalledWith(10, 100, 1, true);
        });
    });

    describe('updateSourceStatus', () => {
        let entityFindSpy: jest.SpyInstance;
        let entitySaveSpy: jest.SpyInstance;
        let kbFindSpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindSpy = jest.fn();
            entitySaveSpy = jest.fn().mockResolvedValue({});
            service.entity = { findOneBy: entityFindSpy, save: entitySaveSpy } as any;
            kbFindSpy = jest.spyOn(KnowledgeBaseEntity, 'findOneBy');
        });

        afterEach(() => {
            kbFindSpy.mockRestore();
        });

        test('should throw if source mapping not found', async () => {
            entityFindSpy.mockResolvedValue(null);
            await expect(service.updateSourceStatus(999, 'active')).rejects.toThrow('Source mapping not found');
        });

        test('should throw if knowledge base not found', async () => {
            entityFindSpy.mockResolvedValue({ id: 1, knowledge_base_id: 10 });
            kbFindSpy.mockResolvedValue(null);
            await expect(service.updateSourceStatus(1, 'active')).rejects.toThrow('Knowledge base not found');
        });

        test('should update source status and save', async () => {
            const source = { id: 1, knowledge_base_id: 10, status: 'inactive' };
            entityFindSpy.mockResolvedValue(source);
            kbFindSpy.mockResolvedValue({ id: 10, company_id: 5 });

            const result = await service.updateSourceStatus(1, 'active');

            expect(entitySaveSpy).toHaveBeenCalled();
            expect(result.status).toBe('active');
        });
    });

    describe('getFriendlySourceName (private)', () => {
        const getName = (details: any) => (service as any).getFriendlySourceName(details);

        test('should return file_name if present', () => {
            expect(getName({ file_name: 'data.csv' })).toBe('data.csv');
        });

        test('should return url if present', () => {
            expect(getName({ url: 'https://example.com/docs' })).toBe('https://example.com/docs');
        });

        test('should return bucket_name if present', () => {
            expect(getName({ bucket_name: 'my-bucket' })).toBe('my-bucket');
        });

        test('should return db_name if present', () => {
            expect(getName({ db_name: 'production_db' })).toBe('production_db');
        });

        test('should return name as fallback', () => {
            expect(getName({ name: 'CustomSource' })).toBe('CustomSource');
        });

        test('should return "Source Details" if nothing found', () => {
            expect(getName({})).toBe('Source Details');
        });

        test('should handle string input (JSON)', () => {
            expect(getName('{"file_name":"test.pdf"}')).toBe('test.pdf');
        });

        test('should handle null input', () => {
            expect(getName(null)).toBe('Source Details');
        });
    });
});
