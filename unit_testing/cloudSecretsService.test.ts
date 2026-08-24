import CloudSecretsService from '../src/services/cloudSecrets/cloudSecretsService.service';
import { CloudSecretsModel } from '../src/database/repository/cloudSecrets/cloudSecrets.model';
import { CloudSecretsEntity } from '../src/entities/cloudSecretsEntity';
import { CloudProviderEntity } from '../src/entities/cloudProviderEntity';
import { MembersEntity } from '../src/entities/membersEntity';

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: {
        log: jest.fn().mockResolvedValue(true),
        logFailureIncident: jest.fn().mockResolvedValue(true),
    },
}));

describe('CloudSecretsService Unit Tests', () => {
    let service: CloudSecretsService;

    beforeEach(() => {
        service = new CloudSecretsService();
        jest.clearAllMocks();
    });

    describe('createPreProcess', () => {
        let findOneSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneSpy = jest.spyOn(CloudSecretsEntity, 'findOne' as any);
        });

        afterEach(() => {
            findOneSpy.mockRestore();
        });

        test('should assign member_id from decryptToken and pass through if no duplicate', async () => {
            findOneSpy.mockResolvedValue(null); // no existing secret with that name

            const model = new CloudSecretsModel();
            model.decryptToken = { member_id: 55 };
            model.name = 'My AWS Key';
            model.company_id = '10';

            const result = await service.createPreProcess(model, null);

            expect(result.member_id).toBe(55);
        });

        test('should reject with E10059 if duplicate secret name exists for CREATE', async () => {
            findOneSpy.mockResolvedValue({ id: 99, name: 'Duplicate Key' });

            const model = new CloudSecretsModel();
            model.decryptToken = { member_id: 55 };
            model.name = 'Duplicate Key';
            model.company_id = '10';
            // InferModel defaults id to null, but the check is `model.id === undefined`
            // so we need to explicitly set it to undefined to simulate a fresh CREATE
            (model as any).id = undefined;

            await expect(service.createPreProcess(model, null)).rejects.toBe('E10059');
        });

        test('should allow update even if secret with same name exists', async () => {
            findOneSpy.mockResolvedValue({ id: 5, name: 'Existing Key' });

            const model = new CloudSecretsModel();
            model.decryptToken = { member_id: 55 };
            model.name = 'Existing Key';
            model.company_id = '10';
            model.id = 5; // UPDATE (id present)

            const result = await service.createPreProcess(model, null);

            expect(result.member_id).toBe(55);
        });
    });

    describe('createPostProcess', () => {
        const AuditLogService = require('../src/services/auditLog/auditLogService.services').default;

        test('should log CREATE audit entry when model has no id (new record)', async () => {
            const result = { id: 10, name: 'New Secret', company_id: 5, member_id: 1 } as any;
            const model = new CloudSecretsModel();
            model.decryptToken = { member_id: 1 };
            // model.id is undefined => CREATE

            const returned = await service.createPostProcess(result, model, null);

            expect(AuditLogService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'CREATE',
                    entity_name: 'New Secret',
                })
            );
            expect(returned).toBe(result);
        });

        test('should log UPDATE audit entry when model has id', async () => {
            const result = { id: 10, name: 'Updated Secret', company_id: 5, member_id: 1 } as any;
            const model = new CloudSecretsModel();
            model.id = 10;
            model.decryptToken = { member_id: 1 };

            const returned = await service.createPostProcess(result, model, null);

            expect(AuditLogService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'UPDATE',
                    entity_name: 'Updated Secret',
                })
            );
            expect(returned).toBe(result);
        });
    });

    describe('updateSecretLastUsed', () => {
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            updateSpy = jest.spyOn(CloudSecretsEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            updateSpy.mockRestore();
        });

        test('should update last_used_at and last_used_by_module', async () => {
            await CloudSecretsService.updateSecretLastUsed(42, 'Dataset');

            expect(updateSpy).toHaveBeenCalledWith(
                { id: 42 },
                expect.objectContaining({
                    last_used_at: expect.any(Date),
                    last_used_by_module: 'Dataset',
                })
            );
        });

        test('should not throw even if update fails', async () => {
            updateSpy.mockRejectedValue(new Error('DB error'));

            // Should not throw
            await expect(
                CloudSecretsService.updateSecretLastUsed(99, 'Model')
            ).resolves.toBeUndefined();
        });
    });

    describe('prepareQuery', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                select: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(2),
                getRawMany: jest.fn().mockResolvedValue([
                    {
                        id: 1,
                        name: 'AWS Key',
                        c_provider_id: 1,
                        cloud_provider_image: 'aws.png',
                        profile_picture: null,
                        member_id: 10,
                    },
                    {
                        id: 2,
                        name: 'GCP Key',
                        c_provider_id: 2,
                        cloud_provider_image: null,
                        profile_picture: 'https://example.com/pic.png',
                        member_id: 11,
                    },
                ]),
            };

            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            };

            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url/file.png');
        });

        test('should return data with totalRecords and apply pagination', async () => {
            const param = { company_id: 10, pageNumber: 1, pageSize: 10 } as any;

            const response = await service.prepareQuery(param);

            expect(service.entity.createQueryBuilder).toHaveBeenCalledWith('secret');
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'secret.company_id = :company_id',
                { company_id: 10 }
            );
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
            expect(response.totalRecords).toBe(2);
            expect(response.data).toHaveLength(2);
        });

        test('should reject with E10020 if company_id is missing', async () => {
            const param = {} as any;

            await expect(service.prepareQuery(param)).rejects.toBe('E10020');
        });

        test('should apply search filter when provided', async () => {
            const param = { company_id: 10, filter: { search: 'aws' } } as any;

            await service.prepareQuery(param);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'LOWER(secret.name) LIKE :search',
                { search: '%aws%' }
            );
        });
    });
});
