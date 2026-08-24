import { BaseServices } from '../src/services/baseService.services';
import { InferModel } from '../src/database/repository/InferModel/InferModel.model';
import { MetaModel } from '../src/core/MetaModel';
import { AwsService } from '../src/core/AwsService';

// Concrete implementation of BaseServices for testing
class TestService extends BaseServices {
    constructor(entity?: any, awsService?: any) {
        super(entity || {}, awsService || new AwsService());
    }

    getModel(): InferModel {
        return new InferModel();
    }

    getDTO(): any {
        return {};
    }
}

class TestServiceWithMeta extends TestService {
    getMetaModel(): MetaModel {
        return new MetaModel('testModel', 'test_file', [
            {
                fileKey: 'test_file',
                allowedSize: 1024,
                allowedExtensions: ['image/png'],
                colName: 'file_path',
                require: 'true',
            },
        ]);
    }
}

jest.mock('../src/core/AwsService', () => ({
    AwsService: jest.fn().mockImplementation(() => ({
        upload: jest.fn().mockResolvedValue([{ path: 'uploaded/file.png' }]),
        deleteFiles: jest.fn().mockResolvedValue(true),
        generateSignedUrl: jest.fn().mockResolvedValue('https://signed.url/file.png'),
    })),
}));

describe('BaseServices Unit Tests', () => {
    let service: TestService;
    let mockEntity: any;
    let mockAwsService: any;

    beforeEach(() => {
        mockEntity = {
            find: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
        };
        mockAwsService = {
            upload: jest.fn().mockResolvedValue([{ path: 'uploaded/file.png' }]),
            deleteFiles: jest.fn().mockResolvedValue(true),
            generateSignedUrl: jest.fn().mockResolvedValue('https://signed.url/file.png'),
        };
        service = new TestService(mockEntity, mockAwsService);
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        test('should call entity.find with default filter and return records', async () => {
            const mockRecords = [{ id: 1 }, { id: 2 }];
            mockEntity.find.mockResolvedValue(mockRecords);

            const result = await service.getAll({} as any);

            expect(mockEntity.find).toHaveBeenCalledWith({
                where: { is_delete: 0 },
                order: { created_at: 'DESC' },
            });
            expect(result).toEqual(mockRecords);
        });

        test('should throw if entity.find throws', async () => {
            mockEntity.find.mockRejectedValue(new Error('DB error'));

            await expect(service.getAll({} as any)).rejects.toThrow('DB error');
        });
    });

    describe('getById', () => {
        test('should find entity by id and return it', async () => {
            const mockRecord = { id: 5, name: 'Test' };
            mockEntity.findOneBy.mockResolvedValue(mockRecord);

            const result = await service.getById({ id: 5 } as any);

            expect(mockEntity.findOneBy).toHaveBeenCalledWith({ id: 5, is_delete: 0 });
            expect(result).toEqual(mockRecord);
        });

        test('should reject with E10021 if entity not found', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);

            await expect(service.getById({ id: 999 } as any)).rejects.toBe('E10021');
        });

        test('should resolve null if id is falsy (new record)', async () => {
            const result = await service.getById({ id: null } as any);

            expect(result).toBeNull();
        });
    });

    describe('createRecord', () => {
        test('should create a new record (no files, no existing entity)', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            const savedRecord = { id: 1, name: 'New' };
            mockEntity.save.mockResolvedValue(savedRecord);

            const model = new InferModel();
            const result = await service.createRecord(model, null);

            expect(mockEntity.save).toHaveBeenCalled();
            expect(result).toEqual(savedRecord);
        });

        test('should update existing record when model has id', async () => {
            const existingEntity = { id: 10, name: 'Existing' };
            mockEntity.findOneBy.mockResolvedValue(existingEntity);
            mockEntity.save.mockResolvedValue({ id: 10, name: 'Updated' });

            const model = new InferModel();
            model.id = 10;
            const result = await service.createRecord(model, null);

            expect(mockEntity.findOneBy).toHaveBeenCalledWith({ id: 10, is_delete: 0 });
            expect(result).toEqual({ id: 10, name: 'Updated' });
        });

        test('should reject if save fails', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            mockEntity.save.mockRejectedValue(new Error('Save error'));

            const model = new InferModel();
            await expect(service.createRecord(model, null)).rejects.toThrow('Save error');
        });
    });

    describe('createRecord with files', () => {
        let serviceWithMeta: TestServiceWithMeta;

        beforeEach(() => {
            serviceWithMeta = new TestServiceWithMeta(mockEntity, mockAwsService);
        });

        test('should upload files and update record after save', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            mockEntity.save.mockResolvedValue({ id: 1, name: 'WithFile' });
            const mockSavedEntity = { save: jest.fn().mockResolvedValue({ id: 1, name: 'WithFile', files: [{ path: 'uploaded/file.png' }] }) };
            mockEntity.create.mockReturnValue(mockSavedEntity);

            const files = [{ fieldname: 'test_file', originalname: 'pic.png', encoding: '7bit', mimetype: 'image/png', buffer: Buffer.alloc(0), size: 100 }] as any;
            const model = new InferModel();

            const result = await serviceWithMeta.createRecord(model, files);

            expect(mockAwsService.upload).toHaveBeenCalledWith(files, 'testModel', 1);
            expect(mockEntity.create).toHaveBeenCalled();
        });

        test('should not upload if files array is empty', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            mockEntity.save.mockResolvedValue({ id: 1, name: 'NoFile' });

            const model = new InferModel();
            const result = await serviceWithMeta.createRecord(model, []);

            expect(mockAwsService.upload).not.toHaveBeenCalled();
            expect(result).toEqual({ id: 1, name: 'NoFile' });
        });
    });

    describe('createMultiRecords', () => {
        test('should save multiple records in sequence', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            mockEntity.save
                .mockResolvedValueOnce({ id: 1, name: 'First' })
                .mockResolvedValueOnce({ id: 2, name: 'Second' });

            const models = [new InferModel(), new InferModel()];
            const result = await service.createMultiRecords(models, null);

            expect(mockEntity.save).toHaveBeenCalledTimes(2);
            expect(result).toHaveLength(2);
        });

        test('should reject if one of the saves fails', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);
            mockEntity.save.mockRejectedValue(new Error('Batch save error'));

            const models = [new InferModel()];
            await expect(service.createMultiRecords(models, null)).rejects.toThrow('Batch save error');
        });
    });

    describe('deleteData', () => {
        test('should find entity, get file paths, delete files and remove entity', async () => {
            const mockRecord = { id: 5, test_file: 'path/to/file.png' };
            mockEntity.findOneBy.mockResolvedValue(mockRecord);
            mockEntity.remove.mockResolvedValue(true);

            const serviceWithMeta = new TestServiceWithMeta(mockEntity, mockAwsService);
            const result = await serviceWithMeta.deleteData({ id: 5 });

            expect(mockAwsService.deleteFiles).toHaveBeenCalledWith(['path/to/file.png']);
            expect(result).toEqual(mockRecord);
        });

        test('should remove entity without deleting files if no file paths', async () => {
            const mockRecord = { id: 6 };
            mockEntity.findOneBy.mockResolvedValue(mockRecord);
            mockEntity.remove.mockResolvedValue(true);

            const serviceWithMeta = new TestServiceWithMeta(mockEntity, mockAwsService);
            const result = await serviceWithMeta.deleteData({ id: 6 });

            expect(mockAwsService.deleteFiles).not.toHaveBeenCalled();
            expect(mockEntity.remove).toHaveBeenCalledWith(6);
        });

        test('should reject with E10021 if entity not found', async () => {
            mockEntity.findOneBy.mockResolvedValue(null);

            await expect(service.deleteData({ id: 999 })).rejects.toBe('E10021');
        });
    });

    describe('updateDeleteFlagData', () => {
        let mockQB: any;

        beforeEach(() => {
            mockQB = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            mockEntity.createQueryBuilder.mockReturnValue(mockQB);
        });

        test('should soft-delete records by setting is_delete = 1', async () => {
            mockEntity.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

            const result = await service.updateDeleteFlagData({ id: [1, 2] } as any);

            expect(mockEntity.find).toHaveBeenCalled();
            expect(mockQB.set).toHaveBeenCalledWith({ is_delete: 1 });
            expect(result).toBe(true);
        });

        test('should return false if no records found', async () => {
            mockEntity.find.mockResolvedValue(null);

            const result = await service.updateDeleteFlagData({ id: 99 } as any);

            expect(result).toBe(false);
        });

        test('should return false if id is null/undefined', async () => {
            const result = await service.updateDeleteFlagData({} as any);

            expect(result).toBe(false);
        });

        test('should handle single id (wrap in array)', async () => {
            mockEntity.find.mockResolvedValue([{ id: 5 }]);

            await service.updateDeleteFlagData({ id: 5 } as any);

            expect(mockEntity.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ is_delete: 0 }),
                })
            );
        });
    });

    describe('generateSignedUrl', () => {
        test('should generate signed URL with correct key path', async () => {
            const url = await service.generateSignedUrl('members', 10, 'avatar.png');

            expect(mockAwsService.generateSignedUrl).toHaveBeenCalledWith(
                expect.stringContaining('members/10/avatar.png')
            );
            expect(url).toBe('https://signed.url/file.png');
        });

        test('should return null if filename is null', async () => {
            const url = await service.generateSignedUrl('members', 10, null as any);

            expect(mockAwsService.generateSignedUrl).not.toHaveBeenCalled();
            expect(url).toBeNull();
        });
    });

    describe('getData', () => {
        test('should call prepareQuery and postProcessAfterGetAll', async () => {
            const param = { company_id: 10 } as any;

            const result = await service.getData(param);

            // Default prepareQuery just returns param
            expect(result).toEqual(param);
        });
    });

    describe('getDataById', () => {
        test('should call prepareQueryById and postProcessGetById', async () => {
            const param = { id: 5 } as any;

            const result = await service.getDataById(param);

            expect(result).toEqual(param);
        });
    });

    describe('transformModel', () => {
        test('should return model unchanged by default', () => {
            const model = new InferModel();
            model.id = 99;

            const result = service.transformModel(model);

            expect(result).toBe(model);
        });
    });

    describe('prepareFilter', () => {
        test('should return default filter with is_delete=0 and DESC order', () => {
            const filter = service.prepareFilter({} as any);

            expect(filter).toEqual({
                where: { is_delete: 0 },
                order: { created_at: 'DESC' },
            });
        });
    });
});
