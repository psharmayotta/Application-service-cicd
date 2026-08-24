import { ILike, In, IsNull } from 'typeorm';
import { AwsService } from '../../core/AwsService';
import Database from '../../database/database';
import { ModelEntity } from '../../entities/modelEntity';
import { ModelCategoryEntity } from '../../entities/modelCategoryEntity';
import { ModelTaskEntity } from '../../entities/modelTaskEntity';
import { ModelProviderEntity } from '../../entities/modelProviderEntity';
import { ModelLibarariesEntity } from '../../entities/modelLibarariesEntity';
import { ModelLicensesEntity } from '../../entities/modelLicensesEntity';
import { SourceEntity } from '../../entities/sourceEntity';
import { ModelTypeEntity } from '../../entities/modelTypeEntity';
import { ModelAPIDetailsEntity } from '../../entities/modelApiDetailsEntity';
import { BaseServices } from '../baseService.services';

interface PublicModelsParams {
    category?: string;
    search?: string;
    provider?: string;
}

class PublicModelService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): any {
        return {};
    }

    getDTO(): any {
        return null;
    }

    getModuleName(): string {
        return 'Public Models';
    }

    private async getDefaultPricingMap(modelIds: number[]): Promise<Map<number, any>> {
        const priceMap = new Map<number, any>();
        if (modelIds.length === 0) return priceMap;

        const dbConnection = Database.getInstance();
        const query = `
            SELECT ppr.*
            FROM price_schema.price_plan pp
            JOIN price_schema.price_plan_rule ppr ON ppr.price_plan_id = pp.id AND ppr.is_delete = 0
            WHERE pp.is_default = true AND pp.is_delete = 0
            AND ppr.resource_id = ANY($1)
            AND ppr.resource_type = 'MODEL'
        `;
        const rows = await dbConnection.executeExternalQuery(query, [modelIds]);

        for (const row of rows) {
            if (row.resource_id) {
                priceMap.set(Number(row.resource_id), row);
            }
        }
        return priceMap;
    }

    async getPublicModels(params: PublicModelsParams): Promise<Record<string, any[]>> {
        try {
            const where: any = {
                is_delete: 0,
                member_id: IsNull(),
                company_id: IsNull(),
            };

            // Filter by search text (model name)
            if (params.search) {
                where.name = ILike(`%${params.search}%`);
            }

            // Expire new_models flag for overdue models
            const now = new Date();
            await this.entity
                .createQueryBuilder()
                .update()
                .set({ new_models: 0 })
                .where('new_models = 1')
                .andWhere('new_models_due_date IS NOT NULL')
                .andWhere('new_models_due_date < :now', { now })
                .execute();

            // Fetch all matching models
            let modelEntities = await this.entity.find({
                where,
                order: { model_rank: 'ASC' },
            });

            // Filter by provider name (post-fetch since provider is a related entity)
            if (params.provider) {
                const providerEntity = await ModelProviderEntity.findOneBy({
                    name: ILike(params.provider),
                    is_delete: 0,
                });
                if (providerEntity) {
                    modelEntities = modelEntities.filter(m => m.model_provider_id === providerEntity.id);
                } else {
                    return {};
                }
            }

            // Filter by category (task category name)
            if (params.category && params.category !== 'all') {
                const taskEntities = await ModelTaskEntity.findBy({ is_delete: 0 });
                const categoryMap: Record<string, string[]> = {
                    text: ['Text generation'],
                    image: ['Text-to-Image', 'Image-to-Text'],
                    audio: ['audio-to-text', 'text-to-speech'],
                    video: [],
                };
                const allowedTaskNames = categoryMap[params.category.toLowerCase()];
                if (allowedTaskNames && allowedTaskNames.length > 0) {
                    const allowedTaskIds = taskEntities
                        .filter(t => allowedTaskNames.some(name => t.name.toLowerCase() === name.toLowerCase()))
                        .map(t => t.id);
                    modelEntities = modelEntities.filter(m => allowedTaskIds.includes(m.model_task_id));
                }
            }

            if (modelEntities.length === 0) return {};

            // Batch-fetch all related data
            const modelIds = modelEntities.map(m => m.id);

            const [categories, tasks, providers, priceMap] = await Promise.all([
                ModelCategoryEntity.findBy({ id: In(modelEntities.map(m => m.model_category_id)), is_delete: 0 }),
                ModelTaskEntity.findBy({ id: In(modelEntities.map(m => m.model_task_id)), is_delete: 0 }),
                ModelProviderEntity.findBy({ id: In(modelEntities.map(m => m.model_provider_id)), is_delete: 0 }),
                this.getDefaultPricingMap(modelIds),
            ]);

            const catMap = new Map(categories.map(i => [i.id, i] as [number, any]));
            const taskMap = new Map(tasks.map(i => [i.id, i] as [number, any]));
            const providerMap = new Map(providers.map(i => [i.id, i] as [number, any]));

            // Build response with only public fields
            const results = await Promise.all(
                modelEntities.map(async (model) => {
                    const taskData = taskMap.get(model.model_task_id);
                    const providerData = providerMap.get(model.model_provider_id);
                    const categoryData = catMap.get(model.model_category_id);
                    const pprData = priceMap.get(model.id);

                    return {
                        id: model.id,
                        name: model.name,
                        description: model.description || '',
                        model_image: model.model_image
                            ? await this.generateSignedUrl('modelImages', model.id, model.model_image)
                            : '',
                        model_task_name: taskData ? taskData.name : '',
                        model_task_icon: taskData?.model_task_icon
                            ? await this.generateSignedUrl('modelTaskMedia', taskData.id, taskData.model_task_icon)
                            : '',
                        model_provider_name: providerData ? providerData.name : '',
                        model_provider_icon: providerData?.model_provider_icon
                            ? await this.generateSignedUrl('modelProviderMedia', providerData.id, providerData.model_provider_icon)
                            : '',
                        model_category_name: categoryData ? categoryData.name : '',
                        input_tokens: model.input_tokens || '',
                        output_tokens: model.output_tokens || '',
                        parameters: model.parameters != null ? String(model.parameters) : '0',
                        popular_models: model.popular_models || 0,
                        new_models: model.new_models || 0,
                        model_rank: model.model_rank || 0,
                        allow_training: model.allow_training || false,
                        allow_playground: model.allow_playground || false,
                        supported_features: model.supported_features || [],
                        pricing: {
                            tin: pprData?.tin ?? null,
                            pin: pprData?.pin ?? null,
                            tout: pprData?.tout ?? null,
                            pout: pprData?.pout ?? null,
                            gsec: pprData?.gsec ?? '',
                            psec: pprData?.psec ?? null,
                        },
                    };
                })
            );

            // Group by model_task_name
            const groupedResponse: Record<string, any[]> = {};
            for (const item of results) {
                const key = item.model_task_name || 'Others';
                if (!groupedResponse[key]) groupedResponse[key] = [];
                groupedResponse[key].push(item);
            }

            return groupedResponse;
        } catch (error) {
            console.error('Error in getPublicModels:', error);
            throw error;
        }
    }

    async getPublicModelDetail(modelId: number): Promise<any> {
        try {
            if (!modelId) {
                throw new Error('Model ID is required');
            }

            // Fetch model
            const modelEntity = await this.entity.findOne({
                where: { id: modelId, is_delete: 0, member_id: IsNull(), company_id: IsNull() },
            });

            if (!modelEntity) {
                throw 'E10021';
            }

            // Fetch related lookup data in parallel
            const [
                modelLibraryData,
                modelCategoryData,
                modelTaskData,
                modelLicenseData,
                modelProviderData,
                sourceData,
                modelTypeData,
                modelAPIDetails,
            ] = await Promise.all([
                ModelLibarariesEntity.findOneBy({ id: modelEntity.model_libararies_id, is_delete: 0 }),
                ModelCategoryEntity.findOneBy({ id: modelEntity.model_category_id, is_delete: 0 }),
                ModelTaskEntity.findOneBy({ id: modelEntity.model_task_id, is_delete: 0 }),
                ModelLicensesEntity.findOneBy({ id: modelEntity.model_licenses_id, is_delete: 0 }),
                ModelProviderEntity.findOneBy({ id: modelEntity.model_provider_id, is_delete: 0 }),
                SourceEntity.findOneBy({ id: modelEntity.model_source_id, is_delete: 0 }),
                ModelTypeEntity.findOneBy({ id: modelEntity.model_type_id, is_delete: 0 }),
                ModelAPIDetailsEntity.find({
                    where: { model_id: modelEntity.id, is_delete: 0 },
                    select: ['language', 'steps'],
                }),
            ]);

            // Fetch pricing from default plan
            const priceMap = await this.getDefaultPricingMap([modelEntity.id]);
            const pprData = priceMap.get(modelEntity.id);

            // Fetch model docs
            let model_docs: any[] = [];
            if (modelEntity.model_docs_ids && modelEntity.model_docs_ids.length > 0) {
                const db = Database.getInstance();
                const docsQuery = `
                    SELECT id, name, short_desc, image_path, link
                    FROM docs_tbl
                    WHERE id = ANY($1) AND is_delete = 0
                `;
                const docsResult = await db.executeExternalQuery(docsQuery, [modelEntity.model_docs_ids]);
                model_docs = Array.isArray(docsResult) ? (Array.isArray(docsResult[0]) ? docsResult[0] : docsResult) : [];
            }

            // Fetch related models (same task, exclude current, limit 4)
            let related_models: any[] = [];
            if (modelEntity.model_task_id) {
                const relatedEntities = await this.entity.find({
                    where: {
                        model_task_id: modelEntity.model_task_id,
                        is_delete: 0,
                        member_id: IsNull(),
                        company_id: IsNull(),
                    },
                    order: { model_rank: 'ASC' },
                    take: 5,
                });

                const filtered = relatedEntities.filter(m => m.id !== modelEntity.id).slice(0, 4);

                // Fetch pricing for related models
                const relatedIds = filtered.map(m => m.id);
                const relatedPriceMap = await this.getDefaultPricingMap(relatedIds);

                // Fetch task & provider data for related models
                const relatedTaskIds = [...new Set(filtered.map(m => m.model_task_id))];
                const relatedProviderIds = [...new Set(filtered.map(m => m.model_provider_id))];
                const [relatedTasks, relatedProviders] = await Promise.all([
                    relatedTaskIds.length > 0 ? ModelTaskEntity.findBy({ id: In(relatedTaskIds), is_delete: 0 }) : [],
                    relatedProviderIds.length > 0 ? ModelProviderEntity.findBy({ id: In(relatedProviderIds), is_delete: 0 }) : [],
                ]);
                const relTaskMap = new Map<number, any>(relatedTasks.map((t: any) => [t.id, t] as [number, any]));
                const relProvMap = new Map<number, any>(relatedProviders.map((p: any) => [p.id, p] as [number, any]));

                related_models = await Promise.all(
                    filtered.map(async (rm) => {
                        const rmTask = relTaskMap.get(rm.model_task_id);
                        const rmProvider = relProvMap.get(rm.model_provider_id);
                        const rmPrice = relatedPriceMap.get(rm.id);
                        return {
                            id: rm.id,
                            name: rm.name,
                            model_task_name: rmTask ? rmTask.name : '',
                            model_task_icon: rmTask?.model_task_icon
                                ? await this.generateSignedUrl('modelTaskMedia', rmTask.id, rmTask.model_task_icon)
                                : '',
                            model_provider_icon: rmProvider?.model_provider_icon
                                ? await this.generateSignedUrl('modelProviderMedia', rmProvider.id, rmProvider.model_provider_icon)
                                : '',
                            input_tokens: rm.input_tokens || '',
                            output_tokens: rm.output_tokens || '',
                            supported_features: rm.supported_features || [],
                            pricing: {
                                tin: rmPrice?.tin ?? null,
                                pin: rmPrice?.pin ?? null,
                                tout: rmPrice?.tout ?? null,
                                pout: rmPrice?.pout ?? null,
                                gsec: rmPrice?.gsec ?? '',
                                psec: rmPrice?.psec ?? null,
                            },
                        };
                    })
                );
            }

            // Build public-safe detail response
            const data = {
                id: modelEntity.id,
                name: modelEntity.name,
                version: modelEntity.version || '',
                description: modelEntity.description || '',
                model_detail: modelEntity.model_detail || '',
                model_image: modelEntity.model_image
                    ? await this.generateSignedUrl('modelImages', modelEntity.id, modelEntity.model_image)
                    : '',
                model_task_name: modelTaskData ? modelTaskData.name : '',
                model_task_icon: modelTaskData?.model_task_icon
                    ? await this.generateSignedUrl('modelTaskMedia', modelTaskData.id, modelTaskData.model_task_icon)
                    : '',
                model_provider_name: modelProviderData ? modelProviderData.name : '',
                model_provider_icon: modelProviderData?.model_provider_icon
                    ? await this.generateSignedUrl('modelProviderMedia', modelProviderData.id, modelProviderData.model_provider_icon)
                    : '',
                model_category_name: modelCategoryData ? modelCategoryData.name : '',
                model_category_icon: modelCategoryData?.model_category_icon
                    ? await this.generateSignedUrl('modelCategoryMedia', modelCategoryData.id, modelCategoryData.model_category_icon)
                    : '',
                model_source_name: sourceData ? sourceData.name : '',
                model_source_icon: sourceData?.model_source_icon
                    ? await this.generateSignedUrl('modelSourceMedia', sourceData.id, sourceData.model_source_icon)
                    : '',
                model_source_repo: modelEntity.model_source_repo || '',
                library_name: modelLibraryData ? modelLibraryData.name : '',
                license_name: modelLicenseData ? modelLicenseData.name : '',
                input_tokens: modelEntity.input_tokens || '',
                output_tokens: modelEntity.output_tokens || '',
                parameters: modelEntity.parameters != null ? String(modelEntity.parameters) : '0',
                per_image_tokens: modelEntity.per_image_tokens || '',
                allow_training: modelEntity.allow_training || false,
                allow_playground: modelEntity.allow_playground || false,
                popular_models: modelEntity.popular_models || 0,
                new_models: modelEntity.new_models || 0,
                supported_features: modelEntity.supported_features || [],
                supported_languages: modelEntity.supported_languages || [],
                input_data_format_support: modelEntity.input_data_format_support || [],
                output_data_format_support: modelEntity.output_data_format_support || [],
                model_developer_and_architecture: modelEntity.model_developer_and_architecture || null,
                pricing: {
                    tin: pprData?.tin ?? null,
                    pin: pprData?.pin ?? null,
                    tout: pprData?.tout ?? null,
                    pout: pprData?.pout ?? null,
                    gsec: pprData?.gsec ?? '',
                    psec: pprData?.psec ?? null,
                },
                api_documentation: modelAPIDetails.map((detail) => ({
                    language: detail.language,
                    steps: detail.steps || [],
                })),
                model_docs,
                related_models,
            };

            return { data };
        } catch (error) {
            console.error('Error in getPublicModelDetail:', error);
            throw error;
        }
    }
}

export default PublicModelService;
