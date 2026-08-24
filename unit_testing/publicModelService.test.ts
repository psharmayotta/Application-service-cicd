import PublicModelService from '../src/services/publicModel/publicModelService.services';
import { ModelEntity } from '../src/entities/modelEntity';
import { ModelCategoryEntity } from '../src/entities/modelCategoryEntity';
import { ModelTaskEntity } from '../src/entities/modelTaskEntity';
import { ModelProviderEntity } from '../src/entities/modelProviderEntity';
import { ModelLibarariesEntity } from '../src/entities/modelLibarariesEntity';
import { ModelLicensesEntity } from '../src/entities/modelLicensesEntity';
import { SourceEntity } from '../src/entities/sourceEntity';
import { ModelTypeEntity } from '../src/entities/modelTypeEntity';
import { ModelAPIDetailsEntity } from '../src/entities/modelApiDetailsEntity';
import Database from '../src/database/database';

jest.mock('../src/core/AwsService', () => ({
    AwsService: jest.fn().mockImplementation(() => ({
        generateSignedUrl: jest.fn().mockResolvedValue('https://cdn.example.com/signed-url'),
    })),
}));

jest.mock('../src/config', () => ({
    AWS_S3_FOLDER_NAME: 'uploads',
    ENABLE_ENCRYPTION: false,
    NON_ENCRYPTION_ENDPOINTS: [],
    PATH: '/Infer/api',
    APILangauge: {
        PYTHON: 'python',
        CURL: 'curl',
        JAVASCRIPT: 'javascript',
        JAVA: 'java',
        GO: 'go',
    },
}));

describe('PublicModelService Unit Tests', () => {
    let service: PublicModelService;
    let mockDbInstance: any;

    const mockModelEntity = {
        id: 31,
        name: 'Llama3-1-8B',
        version: '1.1',
        description: 'A powerful language model',
        model_detail: '<p>Full description</p>',
        model_image: 'image.webp',
        model_task_id: 1,
        model_provider_id: 5,
        model_category_id: 2,
        model_libararies_id: 3,
        model_licenses_id: 4,
        model_source_id: 6,
        model_type_id: 7,
        model_source_repo: 'https://huggingface.co/meta-llama',
        input_tokens: '190',
        output_tokens: '220',
        parameters: 8,
        per_image_tokens: '128',
        allow_training: true,
        allow_playground: true,
        popular_models: 1,
        new_models: 0,
        model_rank: 1,
        supported_features: [{ key: 'context length', value: '128000' }],
        supported_languages: ['English', 'French'],
        input_data_format_support: ['Text'],
        output_data_format_support: ['Text'],
        model_developer_and_architecture: { tags: [], description: 'Transformer' },
        model_docs_ids: [34],
        member_id: null,
        company_id: null,
        is_delete: 0,
    };

    const mockTaskEntity = { id: 1, name: 'Text generation', model_task_icon: 'TextT.svg', is_delete: 0 };
    const mockProviderEntity = { id: 5, name: 'Meta AI', model_provider_icon: 'Meta-logo.png', is_delete: 0 };
    const mockCategoryEntity = { id: 2, name: 'Large Language Model', model_category_icon: 'LLM.svg', is_delete: 0 };
    const mockLibraryEntity = { id: 3, name: 'PyTorch', model_libararies_icon: 'pytorch.png', is_delete: 0 };
    const mockLicenseEntity = { id: 4, name: 'Mit', model_licenses_icon: 'mit.png', is_delete: 0 };
    const mockSourceEntity = { id: 6, name: 'Hugginface', model_source_icon: 'hf-icon.png', is_delete: 0 };
    const mockTypeEntity = { id: 7, name: 'LLM', is_delete: 0 };

    beforeEach(() => {
        service = new PublicModelService();
        mockDbInstance = Database.getInstance();
        jest.clearAllMocks();
    });

    describe('getPublicModels', () => {
        let entityFindSpy: jest.SpyInstance;
        let entityQueryBuilderSpy: jest.SpyInstance;
        let taskFindBySpy: jest.SpyInstance;
        let providerFindBySpy: jest.SpyInstance;
        let categoryFindBySpy: jest.SpyInstance;
        let providerFindOneBySpy: jest.SpyInstance;
        let taskFindByAllSpy: jest.SpyInstance;

        beforeEach(() => {
            // Mock the entity (ModelEntity) on the service instance
            const mockQueryBuilder = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            service.entity = {
                find: jest.fn().mockResolvedValue([mockModelEntity]),
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;

            taskFindBySpy = jest.spyOn(ModelTaskEntity, 'findBy').mockResolvedValue([mockTaskEntity] as any);
            providerFindBySpy = jest.spyOn(ModelProviderEntity, 'findBy').mockResolvedValue([mockProviderEntity] as any);
            categoryFindBySpy = jest.spyOn(ModelCategoryEntity, 'findBy').mockResolvedValue([mockCategoryEntity] as any);
            providerFindOneBySpy = jest.spyOn(ModelProviderEntity, 'findOneBy').mockResolvedValue(mockProviderEntity as any);

            // Mock default pricing query
            mockDbInstance.executeExternalQuery.mockResolvedValue([
                { resource_id: 31, tin: '1000000.000000', pin: '2.000000', tout: '1000000.000000', pout: '3.000000', gsec: '', psec: null }
            ]);
        });

        afterEach(() => {
            taskFindBySpy.mockRestore();
            providerFindBySpy.mockRestore();
            categoryFindBySpy.mockRestore();
            providerFindOneBySpy.mockRestore();
        });

        test('should return models grouped by task name', async () => {
            const result = await service.getPublicModels({});

            expect(result).toHaveProperty('Text generation');
            expect(result['Text generation']).toHaveLength(1);
            expect(result['Text generation'][0].id).toBe(31);
            expect(result['Text generation'][0].name).toBe('Llama3-1-8B');
        });

        test('should include only public-safe fields in list response', async () => {
            const result = await service.getPublicModels({});
            const model = result['Text generation'][0];

            // Should include these fields
            expect(model).toHaveProperty('id');
            expect(model).toHaveProperty('name');
            expect(model).toHaveProperty('description');
            expect(model).toHaveProperty('model_image');
            expect(model).toHaveProperty('model_task_name');
            expect(model).toHaveProperty('model_provider_name');
            expect(model).toHaveProperty('model_category_name');
            expect(model).toHaveProperty('input_tokens');
            expect(model).toHaveProperty('output_tokens');
            expect(model).toHaveProperty('pricing');
            expect(model).toHaveProperty('supported_features');

            // Should NOT include sensitive/internal fields
            expect(model).not.toHaveProperty('playground_config');
            expect(model).not.toHaveProperty('model_train_configuration');
            expect(model).not.toHaveProperty('model_input');
            expect(model).not.toHaveProperty('model_suggestion');
            expect(model).not.toHaveProperty('data_set_configuration');
            expect(model).not.toHaveProperty('docker_image_url');
            expect(model).not.toHaveProperty('model_unique_key');
            expect(model).not.toHaveProperty('member_id');
            expect(model).not.toHaveProperty('company_id');
        });

        test('should include pricing object with correct fields', async () => {
            const result = await service.getPublicModels({});
            const pricing = result['Text generation'][0].pricing;

            expect(pricing).toEqual({
                tin: '1000000.000000',
                pin: '2.000000',
                tout: '1000000.000000',
                pout: '3.000000',
                gsec: '',
                psec: null,
            });
        });

        test('should return empty object when no models match', async () => {
            (service.entity as any).find = jest.fn().mockResolvedValue([]);

            const result = await service.getPublicModels({});

            expect(result).toEqual({});
        });

        test('should filter by search text', async () => {
            await service.getPublicModels({ search: 'llama' });

            expect((service.entity as any).find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        name: expect.anything(),
                    }),
                })
            );
        });

        test('should filter by provider name', async () => {
            providerFindOneBySpy.mockResolvedValue(mockProviderEntity as any);

            const result = await service.getPublicModels({ provider: 'Meta AI' });

            expect(providerFindOneBySpy).toHaveBeenCalled();
            expect(result['Text generation']).toHaveLength(1);
        });

        test('should return empty when provider not found', async () => {
            providerFindOneBySpy.mockResolvedValue(null);

            const result = await service.getPublicModels({ provider: 'NonExistent' });

            expect(result).toEqual({});
        });

        test('should filter by category tab', async () => {
            taskFindBySpy.mockResolvedValue([mockTaskEntity] as any);

            const result = await service.getPublicModels({ category: 'text' });

            expect(result).toHaveProperty('Text generation');
        });

        test('should return all categories when category is "all"', async () => {
            const result = await service.getPublicModels({ category: 'all' });

            expect(result['Text generation']).toHaveLength(1);
        });
    });

    describe('getPublicModelDetail', () => {
        let entityFindOneSpy: jest.SpyInstance;
        let entityFindSpy: jest.SpyInstance;
        let libFindOneBySpy: jest.SpyInstance;
        let catFindOneBySpy: jest.SpyInstance;
        let taskFindOneBySpy: jest.SpyInstance;
        let licenseFindOneBySpy: jest.SpyInstance;
        let providerFindOneBySpy: jest.SpyInstance;
        let sourceFindOneBySpy: jest.SpyInstance;
        let typeFindOneBySpy: jest.SpyInstance;
        let apiDetailsFindSpy: jest.SpyInstance;
        let taskFindBySpy: jest.SpyInstance;
        let providerFindBySpy: jest.SpyInstance;

        beforeEach(() => {
            const mockQueryBuilder = {
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({}),
            };
            service.entity = {
                findOne: jest.fn().mockResolvedValue(mockModelEntity),
                find: jest.fn().mockResolvedValue([
                    { ...mockModelEntity, id: 36, name: 'GPT-OSS-20B' },
                    mockModelEntity,
                ]),
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;

            libFindOneBySpy = jest.spyOn(ModelLibarariesEntity, 'findOneBy').mockResolvedValue(mockLibraryEntity as any);
            catFindOneBySpy = jest.spyOn(ModelCategoryEntity, 'findOneBy').mockResolvedValue(mockCategoryEntity as any);
            taskFindOneBySpy = jest.spyOn(ModelTaskEntity, 'findOneBy').mockResolvedValue(mockTaskEntity as any);
            licenseFindOneBySpy = jest.spyOn(ModelLicensesEntity, 'findOneBy').mockResolvedValue(mockLicenseEntity as any);
            providerFindOneBySpy = jest.spyOn(ModelProviderEntity, 'findOneBy').mockResolvedValue(mockProviderEntity as any);
            sourceFindOneBySpy = jest.spyOn(SourceEntity, 'findOneBy').mockResolvedValue(mockSourceEntity as any);
            typeFindOneBySpy = jest.spyOn(ModelTypeEntity, 'findOneBy').mockResolvedValue(mockTypeEntity as any);
            apiDetailsFindSpy = jest.spyOn(ModelAPIDetailsEntity, 'find').mockResolvedValue([
                { language: 'python', steps: [{ type: 'install', packageName: 'requests' }] }
            ] as any);
            taskFindBySpy = jest.spyOn(ModelTaskEntity, 'findBy').mockResolvedValue([mockTaskEntity] as any);
            providerFindBySpy = jest.spyOn(ModelProviderEntity, 'findBy').mockResolvedValue([mockProviderEntity] as any);

            // Mock pricing and docs queries
            mockDbInstance.executeExternalQuery
                .mockResolvedValueOnce([ // pricing for main model
                    { resource_id: 31, tin: '1000000.000000', pin: '2.000000', tout: '1000000.000000', pout: '3.000000', gsec: '', psec: null }
                ])
                .mockResolvedValueOnce([ // docs query
                    { id: 34, name: 'Dedicated Endpoint', short_desc: 'Exclusive infra', image_path: 'img.png', link: 'https://docs.example.com' }
                ])
                .mockResolvedValueOnce([ // pricing for related models
                    { resource_id: 36, tin: '1000000.000000', pin: '4.000000', tout: '1000000.000000', pout: '5.000000', gsec: '', psec: null }
                ]);
        });

        afterEach(() => {
            libFindOneBySpy.mockRestore();
            catFindOneBySpy.mockRestore();
            taskFindOneBySpy.mockRestore();
            licenseFindOneBySpy.mockRestore();
            providerFindOneBySpy.mockRestore();
            sourceFindOneBySpy.mockRestore();
            typeFindOneBySpy.mockRestore();
            apiDetailsFindSpy.mockRestore();
            taskFindBySpy.mockRestore();
            providerFindBySpy.mockRestore();
        });

        test('should return model detail with data object', async () => {
            const result = await service.getPublicModelDetail(31);

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(31);
            expect(result.data.name).toBe('Llama3-1-8B');
        });

        test('should throw E10021 when model not found', async () => {
            (service.entity as any).findOne = jest.fn().mockResolvedValue(null);

            await expect(service.getPublicModelDetail(999)).rejects.toBe('E10021');
        });

        test('should throw error when modelId is not provided', async () => {
            await expect(service.getPublicModelDetail(0)).rejects.toThrow('Model ID is required');
        });

        test('should include all required detail fields per contract', async () => {
            const result = await service.getPublicModelDetail(31);
            const data = result.data;

            expect(data).toHaveProperty('id');
            expect(data).toHaveProperty('name');
            expect(data).toHaveProperty('version');
            expect(data).toHaveProperty('description');
            expect(data).toHaveProperty('model_detail');
            expect(data).toHaveProperty('model_image');
            expect(data).toHaveProperty('model_task_name');
            expect(data).toHaveProperty('model_task_icon');
            expect(data).toHaveProperty('model_provider_name');
            expect(data).toHaveProperty('model_provider_icon');
            expect(data).toHaveProperty('model_category_name');
            expect(data).toHaveProperty('model_category_icon');
            expect(data).toHaveProperty('model_source_name');
            expect(data).toHaveProperty('model_source_icon');
            expect(data).toHaveProperty('model_source_repo');
            expect(data).toHaveProperty('library_name');
            expect(data).toHaveProperty('license_name');
            expect(data).toHaveProperty('input_tokens');
            expect(data).toHaveProperty('output_tokens');
            expect(data).toHaveProperty('parameters');
            expect(data).toHaveProperty('per_image_tokens');
            expect(data).toHaveProperty('allow_training');
            expect(data).toHaveProperty('allow_playground');
            expect(data).toHaveProperty('supported_features');
            expect(data).toHaveProperty('supported_languages');
            expect(data).toHaveProperty('input_data_format_support');
            expect(data).toHaveProperty('output_data_format_support');
            expect(data).toHaveProperty('model_developer_and_architecture');
            expect(data).toHaveProperty('pricing');
            expect(data).toHaveProperty('api_documentation');
            expect(data).toHaveProperty('model_docs');
            expect(data).toHaveProperty('related_models');
        });

        test('should NOT include sensitive/internal fields in detail response', async () => {
            const result = await service.getPublicModelDetail(31);
            const data = result.data;

            expect(data).not.toHaveProperty('playground_config');
            expect(data).not.toHaveProperty('model_train_configuration');
            expect(data).not.toHaveProperty('model_input');
            expect(data).not.toHaveProperty('model_suggestion');
            expect(data).not.toHaveProperty('infra_allocation_details');
            expect(data).not.toHaveProperty('model_session_key');
            expect(data).not.toHaveProperty('c1');
            expect(data).not.toHaveProperty('c2');
            expect(data).not.toHaveProperty('c3');
            expect(data).not.toHaveProperty('data_set_configuration');
            expect(data).not.toHaveProperty('docker_image_url');
            expect(data).not.toHaveProperty('model_unique_key');
            expect(data).not.toHaveProperty('member_id');
            expect(data).not.toHaveProperty('company_id');
            expect(data).not.toHaveProperty('status');
            expect(data).not.toHaveProperty('status_log');
        });

        test('should include pricing from default plan', async () => {
            const result = await service.getPublicModelDetail(31);

            expect(result.data.pricing).toEqual({
                tin: '1000000.000000',
                pin: '2.000000',
                tout: '1000000.000000',
                pout: '3.000000',
                gsec: '',
                psec: null,
            });
        });

        test('should include api_documentation with language and steps', async () => {
            const result = await service.getPublicModelDetail(31);

            expect(result.data.api_documentation).toHaveLength(1);
            expect(result.data.api_documentation[0].language).toBe('python');
            expect(result.data.api_documentation[0].steps).toEqual([{ type: 'install', packageName: 'requests' }]);
        });

        test('should include model_docs fetched from docs_tbl', async () => {
            const result = await service.getPublicModelDetail(31);

            expect(result.data.model_docs).toHaveLength(1);
            expect(result.data.model_docs[0].name).toBe('Dedicated Endpoint');
        });

        test('should include related_models excluding current model', async () => {
            const result = await service.getPublicModelDetail(31);

            expect(result.data.related_models).toHaveLength(1);
            expect(result.data.related_models[0].id).toBe(36);
            expect(result.data.related_models[0].name).toBe('GPT-OSS-20B');
            expect(result.data.related_models[0]).toHaveProperty('pricing');
            expect(result.data.related_models[0]).toHaveProperty('model_task_name');
        });

        test('should return parsed arrays, not JSON strings', async () => {
            const result = await service.getPublicModelDetail(31);
            const data = result.data;

            expect(Array.isArray(data.supported_features)).toBe(true);
            expect(Array.isArray(data.supported_languages)).toBe(true);
            expect(Array.isArray(data.input_data_format_support)).toBe(true);
            expect(Array.isArray(data.output_data_format_support)).toBe(true);
        });
    });
});
