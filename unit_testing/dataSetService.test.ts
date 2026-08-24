import DataSetService from '../src/services/dataSet/dataSetService.services';
import { DataSetModel } from '../src/database/repository/dataSet/dataset.model';
import { CloudProviderEntity } from '../src/entities/cloudProviderEntity';
import { CloudSecretsEntity } from '../src/entities/cloudSecretsEntity';
import { DataSetEntity } from '../src/entities/dataSetEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { DatasetStatus } from '../src/config';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mockKafkaInstance = {
        sendMessage: jest.fn().mockResolvedValue(true)
    };
    return {
        KafkaService: {
            getInstance: jest.fn().mockReturnValue(mockKafkaInstance)
        }
    };
});

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: {
        pushMessageToCompany: jest.fn().mockResolvedValue(true)
    }
}));

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: {
        log: jest.fn().mockResolvedValue(true),
        logFailureIncident: jest.fn().mockResolvedValue(true)
    }
}));

jest.mock('../src/services/cloudSecrets/cloudSecretsService.service', () => ({
    __esModule: true,
    default: {
        updateSecretLastUsed: jest.fn().mockResolvedValue(true)
    }
}));

jest.mock('../src/services/notification/notificationService.services', () => {
    return {
        NotificationService: class {
            createRecord = jest.fn().mockResolvedValue({ id: 1, message: 'Mock notification' });
        }
    };
});

describe('DataSetService Unit Tests', () => {
    let service: DataSetService;
    let mockKafkaInstance: any;
    let findOneByMembersSpy: jest.SpyInstance;

    beforeEach(() => {
        service = new DataSetService();
        mockKafkaInstance = KafkaService.getInstance();
        findOneByMembersSpy = jest.spyOn(MembersEntity, 'findOneBy').mockResolvedValue({ id: 10, full_name: 'Mock User' } as any);
        jest.clearAllMocks();
    });

    afterEach(() => {
        findOneByMembersSpy.mockRestore();
    });

    describe('transformModel', () => {
        test('should assign member_id from decryptToken', () => {
            const model = new DataSetModel();
            model.decryptToken = { member_id: 101 };

            const processed = service.transformModel(model);

            expect(processed.member_id).toBe(101);
        });
    });

    describe('createPostProcess', () => {
        let findOneByCloudProviderSpy: jest.SpyInstance;
        let findOneByCloudSecretsSpy: jest.SpyInstance;
        let updateEntitySpy: jest.SpyInstance;

        beforeEach(() => {
            findOneByCloudProviderSpy = jest.spyOn(CloudProviderEntity, 'findOneBy');
            findOneByCloudSecretsSpy = jest.spyOn(CloudSecretsEntity, 'findOneBy');
            updateEntitySpy = jest.spyOn(DataSetEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            findOneByCloudProviderSpy.mockRestore();
            findOneByCloudSecretsSpy.mockRestore();
            updateEntitySpy.mockRestore();
        });

        test('should immediately set success status for local file uploads', async () => {
            findOneByCloudProviderSpy.mockResolvedValue({ name: 'File Upload' });
            findOneByCloudSecretsSpy.mockResolvedValue(null);

            const result = {
                id: 1,
                cloud_service_id: 2,
                company_id: 100,
                member_id: 10,
                name: 'LocalDataset',
                dataset_path: 'uploads/file.csv'
            } as any;

            const returned = await service.createPostProcess(result, new DataSetModel(), null);

            expect(updateEntitySpy).toHaveBeenCalledWith(
                { id: 1 },
                expect.objectContaining({
                    status: DatasetStatus.SUCCESS,
                    download_status: true
                })
            );
            expect(returned.status).toBe(DatasetStatus.SUCCESS);
        });

        test('should send Kafka init event and set uploading status for external source imports', async () => {
            findOneByCloudProviderSpy.mockResolvedValue({ name: 'AWS S3' });
            findOneByCloudSecretsSpy.mockResolvedValue({ secrets: { access_key: '123' } });

            const result = {
                id: 2,
                cloud_service_id: 3,
                cloud_secret_id: 4,
                company_id: 100,
                member_id: 10,
                name: 'CloudDataset',
                dataset_path: 's3://my-bucket/file.csv'
            } as any;

            await service.createPostProcess(result, new DataSetModel(), null);

            expect(updateEntitySpy).toHaveBeenCalledWith({ id: 2 }, { status: DatasetStatus.UPLOADING });
            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    dataset_id: 2,
                    source: 'AWS S3'
                })
            );
        });
    });

    describe('updateStatus', () => {
        let findOneBySpy: jest.SpyInstance;
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.spyOn(DataSetEntity, 'findOneBy');
            updateSpy = jest.spyOn(DataSetEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            findOneBySpy.mockRestore();
            updateSpy.mockRestore();
        });

        test('should update status and trigger WebSocket update', async () => {
            const existingRecord = { id: 5, status: DatasetStatus.PENDING, company_id: 100 };
            findOneBySpy.mockResolvedValue(existingRecord);

            const updateModel = new DataSetModel();
            updateModel.id = 5;
            updateModel.status = DatasetStatus.SUCCESS;
            updateModel.download_status = true;
            updateModel.size = '10MB';

            const msg = await service.updateStatus(updateModel);

            expect(updateSpy).toHaveBeenCalledWith(
                { id: 5 },
                expect.objectContaining({
                    status: DatasetStatus.SUCCESS,
                    size: '10MB'
                })
            );
            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith('100', expect.any(Object));
            expect(msg).toBe('Data Set Status Updated Successfully');
        });

        test('should reject if dataset record is not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            const updateModel = new DataSetModel();
            updateModel.id = 999;

            await expect(service.updateStatus(updateModel)).rejects.toBe('E10029');
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
                    { id: 1, dataset_name: 'DS1', profile_picture: null, cloud_provider_icon: null, member_id: 5, cloud_provider_id: 1 },
                ]),
                getCount: jest.fn().mockResolvedValue(1),
            };
            service.entity = { createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder) } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://signed.url');
        });

        test('should return paginated data', async () => {
            const response = await service.prepareQuery({ company_id: 10, pageNumber: 1, pageSize: 10 } as any);
            expect(response.data).toHaveLength(1);
            expect(response.pagination.total).toBe(1);
        });

        test('should apply search_text filter', async () => {
            await service.prepareQuery({ company_id: 10, search_text: 'train' } as any);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('LOWER(dataset.name) LIKE :search'),
                expect.objectContaining({ search: '%train%' })
            );
        });

        test('should apply status filter as array', async () => {
            await service.prepareQuery({ company_id: 10, status: ['success', 'failed'] } as any);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'LOWER(dataset.status) IN (:...datasetStatuses)',
                { datasetStatuses: ['success', 'failed'] }
            );
        });

        test('should apply module_name filter', async () => {
            await service.prepareQuery({ company_id: 10, module_name: 'Training' } as any);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'dataset.module_name = :moduleName',
                { moduleName: 'Training' }
            );
        });

        test('should apply category_id filter', async () => {
            await service.prepareQuery({ company_id: 10, category_id: 5 } as any);
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'dataset.category_id = :categoryId',
                { categoryId: 5 }
            );
        });
    });

    describe('updateDeleteFlagData', () => {
        let entityFindSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindSpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = { find: entityFindSpy, update: entityUpdateSpy } as any;
        });

        test('should soft-delete and trigger billing/audit for each record', async () => {
            entityFindSpy.mockResolvedValue([{ id: 1, company_id: 10, member_id: 5, name: 'DS1', size: '10MB' }]);

            const result = await service.updateDeleteFlagData({ id: 1, decryptToken: { member_id: 5 } } as any);

            expect(result).toBe(true);
            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: expect.anything() }, { is_delete: 1 });
        });

        test('should throw E10073 if no records found', async () => {
            entityFindSpy.mockResolvedValue(null);

            await expect(service.updateDeleteFlagData({ id: 999 } as any)).rejects.toBe('E10073');
        });
    });

    describe('restoreData', () => {
        let entityFindOneSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindOneSpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = { findOne: entityFindOneSpy, update: entityUpdateSpy } as any;
        });

        test('should restore deleted record by setting is_delete to 0', async () => {
            entityFindOneSpy.mockResolvedValue({ id: 1, is_delete: 1 });

            const result = await service.restoreData({ id: 1 });

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, { is_delete: 0 });
            expect(result).toBe(true);
        });

        test('should throw E10073 if record not found', async () => {
            entityFindOneSpy.mockResolvedValue(null);

            await expect(service.restoreData({ id: 999 })).rejects.toBe('E10073');
        });
    });
});
