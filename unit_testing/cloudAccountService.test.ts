import CloudAccountService from '../src/services/cloudAccount/cloudAccountService.services';
import { CloudAccountEntity } from '../src/entities/cloudAccountEntity';
import { CloudSecretsEntity } from '../src/entities/cloudSecretsEntity';

describe('CloudAccountService Unit Tests', () => {
    let service: CloudAccountService;

    beforeEach(() => {
        service = new CloudAccountService();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Cloud Account" as module name', () => {
            expect(service.getModuleName()).toBe('Cloud Account');
        });

        test('should return model and DTO', () => {
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = { decryptToken: { member_id: 42 } } as any;
            const result = service.transformModel(model);
            expect(result.member_id).toBe(42);
        });
    });

    describe('createPreProcess', () => {
        let findOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.fn();
            service.entity = { findOneBy: findOneBySpy } as any;
        });

        test('should reject E10061 if account name exists for company (create)', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, account_name: 'Existing' });

            const model = {
                account_name: 'Existing',
                company_id: 10,
                cloud_secret_id: 5,
                decryptToken: { member_id: 1 },
            } as any;
            (model as any).id = undefined;

            await expect(service.createPreProcess(model, null)).rejects.toBe('E10061');
        });

        test('should reject E10024 if duplicate name exists for different id (update)', async () => {
            findOneBySpy
                .mockResolvedValueOnce(null)  // first check (original name check)
                .mockResolvedValueOnce({ id: 2, account_name: 'Taken' }) // name unique check
                .mockResolvedValueOnce(null); // secret check

            const model = {
                id: 1,
                account_name: 'Taken',
                company_id: 10,
                cloud_secret_id: 5,
                decryptToken: { member_id: 1 },
            } as any;

            await expect(service.createPreProcess(model, null)).rejects.toBe('E10024');
        });

        test('should reject E10031 if secret is already tagged to another account', async () => {
            findOneBySpy
                .mockResolvedValueOnce(null)  // first check
                .mockResolvedValueOnce(null)  // name unique
                .mockResolvedValueOnce({ id: 99, cloud_secret_id: 5 }); // secret tagged

            const model = {
                account_name: 'NewAccount',
                company_id: 10,
                cloud_secret_id: 5,
                decryptToken: { member_id: 1 },
            } as any;
            (model as any).id = undefined;

            await expect(service.createPreProcess(model, null)).rejects.toBe('E10031');
        });

        test('should resolve with transformed model if all checks pass', async () => {
            findOneBySpy.mockResolvedValue(null);

            const model = {
                account_name: 'Fresh',
                company_id: 10,
                cloud_secret_id: 5,
                decryptToken: { member_id: 42 },
            } as any;
            (model as any).id = undefined;

            const result = await service.createPreProcess(model, null);
            expect(result.member_id).toBe(42);
        });
    });

    describe('createPostProcess', () => {
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            updateSpy = jest.spyOn(CloudSecretsEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            updateSpy.mockRestore();
        });

        test('should mark cloud secret as active (status=true)', async () => {
            const result = { id: 1, cloud_secret_id: 5 } as any;
            const model = {} as any;

            const returned = await service.createPostProcess(result, model, null);

            expect(updateSpy).toHaveBeenCalledWith({ id: 5 }, { status: true });
            expect(returned).toBe(result);
        });
    });

    describe('prepareQuery', () => {
        let mockQB: any;

        beforeEach(() => {
            mockQB = {
                select: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(2),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, account_name: 'AWS Prod', cloud_provider_image: null, profile_picture: null },
                    { id: 2, account_name: 'GCP Dev', cloud_provider_image: 'img.png', profile_picture: 'pic.png' },
                ]),
            };
            service.entity = { createQueryBuilder: jest.fn().mockReturnValue(mockQB) } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should reject with E10020 if company_id is missing', async () => {
            await expect(service.prepareQuery({} as any)).rejects.toBe('E10020');
        });

        test('should return paginated data with signed URLs', async () => {
            const response = await service.prepareQuery({ company_id: 10, pageNumber: 1, pageSize: 10 } as any);
            expect(response.data).toHaveLength(2);
            expect(response.totalRecords).toBe(2);
        });

        test('should apply search filter', async () => {
            await service.prepareQuery({ company_id: 10, filter: { search: 'aws' } } as any);
            expect(mockQB.andWhere).toHaveBeenCalledWith(
                'LOWER(cloudAccount.account_name) LIKE :search',
                { search: '%aws%' }
            );
        });
    });
});
