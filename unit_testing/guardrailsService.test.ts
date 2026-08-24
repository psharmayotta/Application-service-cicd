import GuardrailsService from '../src/services/guardrails/guardrailsService.services';
import { Guardrails } from '../src/database/repository/guardrails/guardrails.model';
import { ModelCategoryEntity } from '../src/entities/modelCategoryEntity';
import { KafkaService } from '../src/utils/kafka/KafkaService';

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

describe('GuardrailsService Unit Tests', () => {
    let service: GuardrailsService;
    let mockKafkaInstance: any;

    beforeEach(() => {
        service = new GuardrailsService();
        mockKafkaInstance = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('createPreProcess', () => {
        test('should assign member_id if decryptToken is present', async () => {
            const model = new Guardrails();
            model.decryptToken = { member_id: 456 };

            const processed = await service.createPreProcess(model, null);

            expect(processed.member_id).toBe(456);
        });

        test('should leave member_id unchanged if decryptToken is not present', async () => {
            const model = new Guardrails();
            model.member_id = 789;

            const processed = await service.createPreProcess(model, null);

            expect(processed.member_id).toBe(789);
        });
    });

    describe('createPostProcess', () => {
        let findOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.spyOn(ModelCategoryEntity, 'findOneBy');
        });

        afterEach(() => {
            findOneBySpy.mockRestore();
        });

        test('should fetch category name and send init payload to Kafka', async () => {
            findOneBySpy.mockResolvedValue({ name: 'General Safety' });

            const resultModel = {
                id: 1,
                company_id: 10,
                guardrail_name: 'Test Guardrail',
                description: 'A test safety policy',
                model_category_id: 5,
                configure_filters: { prompt_injection: true },
                blocked_input_message: 'Blocked input',
                blocked_output_message: 'Blocked output'
            } as any;

            const modelInput = new Guardrails();
            modelInput.id = 1; // indicates UPDATE action

            const returned = await service.createPostProcess(resultModel, modelInput, null);

            expect(findOneBySpy).toHaveBeenCalledWith({ id: 5 });
            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: 1,
                    company_id: 10,
                    guardrail_name: 'Test Guardrail',
                    model_category_name: 'General Safety',
                    action: 'UPDATE'
                })
            );
            expect(returned).toBe(resultModel);
        });

        test('should resolve result even if Kafka send fails', async () => {
            findOneBySpy.mockResolvedValue(null);
            mockKafkaInstance.sendMessage.mockRejectedValue(new Error('Kafka timeout'));

            const resultModel = { id: 2, guardrail_name: 'Failing Kafka' } as any;
            const modelInput = new Guardrails(); // indicates CREATE action (no id)

            const returned = await service.createPostProcess(resultModel, modelInput, null);

            expect(returned).toBe(resultModel);
        });
    });

    describe('prepareQuery', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                leftJoin: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(1),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    {
                        id: 1,
                        guardrail_name: 'Test',
                        prompt_injection: true,
                        content_moderation: false,
                        profile_picture: 'pic.png',
                        member_id: 100
                    }
                ])
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder)
            } as any;
            jest.spyOn(service, 'generateSignedUrl').mockResolvedValue('https://s3.signed-url.com/pic.png');
        });

        test('should build query and return data with active toggle counts and signed profile pictures', async () => {
            const params = {
                company_id: 10,
                pageNumber: 1,
                pageSize: 10
            } as any;

            const response = await service.prepareQuery(params);

            expect((service.entity as any).createQueryBuilder).toHaveBeenCalledWith('gr');
            expect(mockQueryBuilder.leftJoin).toHaveBeenCalledTimes(2);
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('gr.company_id = :companyId', { companyId: 10 });
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
            expect(response.data[0].profile_picture).toBe('https://s3.signed-url.com/pic.png');
            expect(response.data[0].configure_filters).toBe(1); // Only prompt_injection is true
            expect(response.pagination.total).toBe(1);
        });

        test('should apply toggle filters OR conditions when configured_filters are specified', async () => {
            const params = {
                company_id: 10,
                configured_filters: ['prompt_injection', 'content_moderation']
            } as any;

            await service.prepareQuery(params);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('(gr.prompt_injection = true OR gr.content_moderation = true)');
        });
    });
});
