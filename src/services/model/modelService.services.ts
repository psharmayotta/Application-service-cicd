import CryptoJS from 'crypto-js';
import { ILike, In, IsNull } from "typeorm";
import { InfraAllocationModuleType } from "../../config";
import { AwsService } from "../../core/AwsService";
import { ModelFilter } from "../../core/InferParams";
import Database from '../../database/database';
import { ModelDto } from "../../database/repository/model/model.dto";
import { Model } from "../../database/repository/model/model.model";
import { ApiKeyTokenEntity } from "../../entities/apiKeyTokenEntity";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { ModelAPIDetailsEntity } from "../../entities/modelApiDetailsEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelLibarariesEntity } from "../../entities/modelLibarariesEntity";
import { ModelLicensesEntity } from "../../entities/modelLicensesEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { ModelTypeEntity } from "../../entities/modelTypeEntity";
import { SourceEntity } from "../../entities/sourceEntity";
import { BaseServices } from "../baseService.services";
import { createjwt } from "../../utils/jwt/jwt";

class ModelClassService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): Model {
        return new Model()
    }

    getDTO(): any {
        return ModelDto;
    }

    getModuleName(): string {
        return 'Model Details';
    }

    // async prepareQuery(param: ModelFilter): Promise<Record<string, any[]>> {
    //     try {
    //         // Base filter
    //         const where: any = {
    //             is_delete: 0,
    //             member_id: IsNull(),
    //             company_id: IsNull(),
    //         };
    //         let modelPrice: any[] = [];

    //         if (param.company_id) {
    //             const query = `
    //                 SELECT ppr.* 
    //                 FROM v0_dev_yotta.company c
    //                 LEFT JOIN price_schema.price_plan_rule ppr 
    //                     ON c.price_plan_id = ppr.price_plan_id 
    //                 AND ppr.is_delete = 0
    //                 WHERE c.id = ${param.company_id} 
    //                 AND c.is_delete = 0
    //             `;
    //             const dbConnection = Database.getInstance();
    //             modelPrice = await dbConnection.executeExternalQuery(query);
    //         }

    //         const resourceIds = modelPrice
    //             .map((row: any) => row.resource_id)
    //             .filter((id: any) => id !== null && id !== undefined);

    //         if (resourceIds.length > 0) {
    //             where.id = In(resourceIds);
    //         }
    //         if (param.model_category_id) {
    //             where.model_category_id = param.model_category_id;
    //         }


    //         if (param.model_task_id) {
    //             where.model_task_id = Array.isArray(param.model_task_id) ? In(param.model_task_id) : param.model_task_id;
    //         }

    //         if (param.model_libararies_id) {
    //             where.model_libararies_id = Array.isArray(param.model_libararies_id) ? In(param.model_libararies_id) : param.model_libararies_id;
    //         }

    //         if (param.model_provider_id) {
    //             where.model_provider_id = Array.isArray(param.model_provider_id) ? In(param.model_provider_id) : param.model_provider_id;
    //         }

    //         if (param.allow_training) {
    //             where.allow_training = param.allow_training;
    //         }

    //         if (param.search_text) {
    //             where.name = ILike(`%${param.search_text}%`);
    //         }

    //         if (param.is_new) {
    //             where.new_models = param.is_new;
    //         }

    //         if (param.is_popular) {
    //             where.popular_models = param.is_popular;
    //         }

    //         if (param.is_suggetion) {
    //             where.is_suggetion = param.is_suggetion;
    //         }


    //         const now = new Date();

    //         await this.entity
    //             .createQueryBuilder()
    //             .update()
    //             .set({ new_models: 0 })
    //             .where("new_models = 1")
    //             .andWhere("new_models_due_date IS NOT NULL")
    //             .andWhere("new_models_due_date < :now", { now })
    //             .execute();

    //         const modelEntities = await this.entity.find({
    //             where,
    //             order: { model_rank: 'ASC' }
    //         });
    //         // Map each model entity to its related data
    //         const results = await Promise.all(
    //             modelEntities.map(async (modelEntity) => {
    //                 // Fetch related data for the current model entity in parallel
    //                 const [
    //                     modelLibraryData,
    //                     modelCategoryData,
    //                     modelTaskData,
    //                     modelLicenseData,
    //                     modelProviderData,
    //                     sourceData,
    //                     modelTypeData,
    //                     modelAPIDetails,
    //                 ] = await Promise.all([
    //                     ModelLibarariesEntity.findOneBy({ id: modelEntity.model_libararies_id, is_delete: 0 }), // Fixed typo
    //                     ModelCategoryEntity.findOneBy({ id: modelEntity.model_category_id, is_delete: 0 }),
    //                     ModelTaskEntity.findOneBy({ id: modelEntity.model_task_id, is_delete: 0 }),
    //                     ModelLicensesEntity.findOneBy({ id: modelEntity.model_licenses_id, is_delete: 0 }),
    //                     ModelProviderEntity.findOneBy({ id: modelEntity.model_provider_id, is_delete: 0 }),
    //                     SourceEntity.findOneBy({ id: modelEntity.model_source_id, is_delete: 0 }),
    //                     ModelTypeEntity.findOneBy({ id: modelEntity.model_type_id, is_delete: 0 }),
    //                     ModelAPIDetailsEntity.findBy({ model_id: modelEntity.id, is_delete: 0 }),
    //                 ]);

    //                 // const {
    //                 //     playground_config,
    //                 //     model_train_configuration,
    //                 //     model_detail,
    //                 //     model_suggestion,
    //                 //     model_input,
    //                 //     data_set_configuration,
    //                 //     ...safeModelEntity
    //                 // } = modelEntity;
    //                 const priceRuleMap = new Map<number, any>();

    //                 for (const row of modelPrice) {
    //                     if (row.resource_id) {
    //                         priceRuleMap.set(Number(row.resource_id), row);
    //                     }
    //                 }
    //                 const pprData = priceRuleMap.get(modelEntity.id);
    //                 const result = {
    //                     ...modelEntity, // Spread the model entity properties
    //                     resource_type: pprData?.resource_type ?? null,
    //                     tin: pprData?.tin ?? null,
    //                     pin: pprData?.pin ?? null,
    //                     tout: pprData?.tout ?? null,
    //                     pout: pprData?.pout ?? null,
    //                     c1: pprData?.c1 ?? null,
    //                     c2: pprData?.c2 ?? null,
    //                     c3: pprData?.c3 ?? null,
    //                     gsec: pprData?.gsec ?? null,
    //                     psec: pprData?.psec ?? null,
    //                     model_category_name: modelCategoryData ? modelCategoryData.name : '',
    //                     model_libraries_name: modelLibraryData ? modelLibraryData.name : '',
    //                     model_licenses_name: modelLicenseData ? modelLicenseData.name : '',
    //                     model_task_name: modelTaskData ? modelTaskData.name : '',
    //                     model_provider_name: modelProviderData ? modelProviderData.name : '',
    //                     model_source_name: sourceData ? sourceData.name : '',
    //                     model_type_name: modelTypeData ? modelTypeData.name : '',
    //                     model_api_details: modelAPIDetails || [],
    //                     model_task_icon: modelTaskData ? modelTaskData.model_task_icon ? await this.generateSignedUrl(
    //                         'modelTaskMedia',
    //                         modelTaskData.id,
    //                         modelTaskData.model_task_icon
    //                     )
    //                         : '' : '',

    //                     model_provider_icon: modelProviderData ? modelProviderData.model_provider_icon ? await this.generateSignedUrl(
    //                         'modelProviderMedia',
    //                         modelProviderData.id,
    //                         modelProviderData.model_provider_icon
    //                     )
    //                         : '' : '',

    //                     model_source_icon: sourceData ? sourceData.model_source_icon ? await this.generateSignedUrl(
    //                         'modelSourceMedia',
    //                         sourceData.id,
    //                         sourceData.model_source_icon
    //                     )
    //                         : '' : '',
    //                     model_licenses_icon: modelLicenseData ? modelLicenseData.model_licenses_icon ? await this.generateSignedUrl(
    //                         'modelLicenseMedia',
    //                         modelLicenseData.id,
    //                         modelLicenseData.model_licenses_icon
    //                     )
    //                         : '' : '',
    //                     model_libararies_icon: modelLibraryData ? modelLibraryData.model_libararies_icon ? await this.generateSignedUrl(
    //                         'modelLibarariesMedia',
    //                         modelLibraryData.id,
    //                         modelLibraryData.model_libararies_icon
    //                     )
    //                         : '' : '',
    //                     signedUrl_model_image: modelEntity.model_image
    //                         ? await this.generateSignedUrl(
    //                             'modelImages',
    //                             modelEntity.id,
    //                             modelEntity.model_image
    //                         )
    //                         : '',
    //                 };

    //                 return result;
    //             })
    //         );

    //         const groupedResponse: Record<string, any[]> = {};

    //         for (const item of results) {
    //             const key = item.model_task_name || 'Others';

    //             if (!groupedResponse[key]) {
    //                 groupedResponse[key] = [];
    //             }

    //             groupedResponse[key].push(item);
    //         }

    //         return groupedResponse;
    //     } catch (error) {
    //         console.error('Error in prepareQuery:', error);
    //         throw error;
    //     }
    // }

    async prepareQuery(param: ModelFilter): Promise<Record<string, any[]>> {
        try {
            // Base filter
            const where: any = {
                is_delete: 0,
                member_id: IsNull(),
                company_id: IsNull(),
            };
            let modelPrice: any[] = [];

            if (param.company_id) {
                const query = `
                    SELECT ppr.* 
                    FROM v0_dev_yotta.company c
                    LEFT JOIN price_schema.price_plan_rule ppr 
                        ON c.price_plan_id = ppr.price_plan_id 
                    AND ppr.is_delete = 0
                    WHERE c.id = ${param.company_id} 
                    AND c.is_delete = 0
                `;
                const dbConnection = Database.getInstance();
                modelPrice = await dbConnection.executeExternalQuery(query);
            }

            const resourceIds = modelPrice
                .map((row: any) => row.resource_id)
                .filter((id: any) => id !== null && id !== undefined);

            if (resourceIds.length > 0) {
                where.id = In(resourceIds);
            }

            if (param.model_category_id) {
                where.model_category_id = param.model_category_id;
            }

            if (param.model_task_id) {
                where.model_task_id = Array.isArray(param.model_task_id) ? In(param.model_task_id) : param.model_task_id;
            }

            if (param.model_libararies_id) {
                where.model_libararies_id = Array.isArray(param.model_libararies_id) ? In(param.model_libararies_id) : param.model_libararies_id;
            }

            if (param.model_provider_id) {
                where.model_provider_id = Array.isArray(param.model_provider_id) ? In(param.model_provider_id) : param.model_provider_id;
            }

            if (param.allow_training) {
                where.allow_training = param.allow_training;
            }

            if (param.search_text) {
                where.name = ILike(`%${param.search_text}%`);
            }

            if (param.is_new) {
                where.new_models = param.is_new;
            }

            if (param.is_popular) {
                where.popular_models = param.is_popular;
            }

            if (param.is_suggetion) {
                where.is_suggetion = param.is_suggetion;
            }

            const now = new Date();

            await this.entity
                .createQueryBuilder()
                .update()
                .set({ new_models: 0 })
                .where("new_models = 1")
                .andWhere("new_models_due_date IS NOT NULL")
                .andWhere("new_models_due_date < :now", { now })
                .execute();

            const modelEntities = await this.entity.find({
                where,
                order: { model_rank: 'ASC' }
            });

            const priceRuleMap = new Map<number, any>();
            for (const row of modelPrice) {
                if (row.resource_id) {
                    priceRuleMap.set(Number(row.resource_id), row);
                }
            }

            const modelIds = modelEntities.map(m => m.id);

            const [
                libraries,
                categories,
                tasks,
                licenses,
                providers,
                sources,
                types,
                apiDetails,
            ] = await Promise.all([
                ModelLibarariesEntity.findBy({ id: In(modelEntities.map(m => m.model_libararies_id)), is_delete: 0 }),
                ModelCategoryEntity.findBy({ id: In(modelEntities.map(m => m.model_category_id)), is_delete: 0 }),
                ModelTaskEntity.findBy({ id: In(modelEntities.map(m => m.model_task_id)), is_delete: 0 }),
                ModelLicensesEntity.findBy({ id: In(modelEntities.map(m => m.model_licenses_id)), is_delete: 0 }),
                ModelProviderEntity.findBy({ id: In(modelEntities.map(m => m.model_provider_id)), is_delete: 0 }),
                SourceEntity.findBy({ id: In(modelEntities.map(m => m.model_source_id)), is_delete: 0 }),
                ModelTypeEntity.findBy({ id: In(modelEntities.map(m => m.model_type_id)), is_delete: 0 }),
                ModelAPIDetailsEntity.findBy({ model_id: In(modelIds), is_delete: 0 }),
            ]);

            const libMap = new Map(libraries.map(i => [i.id, i]));
            const catMap = new Map(categories.map(i => [i.id, i]));
            const taskMap = new Map(tasks.map(i => [i.id, i]));
            const licenseMap = new Map(licenses.map(i => [i.id, i]));
            const providerMap = new Map(providers.map(i => [i.id, i]));
            const sourceMap = new Map(sources.map(i => [i.id, i]));
            const typeMap = new Map(types.map(i => [i.id, i]));

            const apiMap = new Map<number, any[]>();
            for (const api of apiDetails) {
                if (!apiMap.has(api.model_id)) apiMap.set(api.model_id, []);
                apiMap.get(api.model_id)!.push(api);
            }

            const results = await Promise.all(
                modelEntities.map(async (modelEntity) => {

                    const modelLibraryData = libMap.get(modelEntity.model_libararies_id);
                    const modelCategoryData = catMap.get(modelEntity.model_category_id);
                    const modelTaskData = taskMap.get(modelEntity.model_task_id);
                    const modelLicenseData = licenseMap.get(modelEntity.model_licenses_id);
                    const modelProviderData = providerMap.get(modelEntity.model_provider_id);
                    const sourceData = sourceMap.get(modelEntity.model_source_id);
                    const modelTypeData = typeMap.get(modelEntity.model_type_id);
                    const modelAPIDetails = apiMap.get(modelEntity.id) || [];

                    const pprData = priceRuleMap.get(modelEntity.id);
                    const result = {
                        ...modelEntity,
                        resource_type: pprData?.resource_type ?? null,
                        tin: pprData?.tin ?? null,
                        pin: pprData?.pin ?? null,
                        tout: pprData?.tout ?? null,
                        pout: pprData?.pout ?? null,
                        c1: pprData?.c1 ?? null,
                        c2: pprData?.c2 ?? null,
                        c3: pprData?.c3 ?? null,
                        gsec: pprData?.gsec ?? null,
                        psec: pprData?.psec ?? null,
                        model_category_name: modelCategoryData ? modelCategoryData.name : '',
                        model_libraries_name: modelLibraryData ? modelLibraryData.name : '',
                        model_licenses_name: modelLicenseData ? modelLicenseData.name : '',
                        model_task_name: modelTaskData ? modelTaskData.name : '',
                        model_provider_name: modelProviderData ? modelProviderData.name : '',
                        model_source_name: sourceData ? sourceData.name : '',
                        model_type_name: modelTypeData ? modelTypeData.name : '',
                        model_api_details: modelAPIDetails || [],

                        model_task_icon: modelTaskData?.model_task_icon
                            ? await this.generateSignedUrl('modelTaskMedia', modelTaskData.id, modelTaskData.model_task_icon)
                            : '',

                        model_provider_icon: modelProviderData?.model_provider_icon
                            ? await this.generateSignedUrl('modelProviderMedia', modelProviderData.id, modelProviderData.model_provider_icon)
                            : '',

                        model_source_icon: sourceData?.model_source_icon
                            ? await this.generateSignedUrl('modelSourceMedia', sourceData.id, sourceData.model_source_icon)
                            : '',

                        model_licenses_icon: modelLicenseData?.model_licenses_icon
                            ? await this.generateSignedUrl('modelLicenseMedia', modelLicenseData.id, modelLicenseData.model_licenses_icon)
                            : '',

                        model_libararies_icon: modelLibraryData?.model_libararies_icon
                            ? await this.generateSignedUrl('modelLibarariesMedia', modelLibraryData.id, modelLibraryData.model_libararies_icon)
                            : '',

                        signedUrl_model_image: modelEntity.model_image
                            ? await this.generateSignedUrl('modelImages', modelEntity.id, modelEntity.model_image)
                            : '',
                    };

                    return result;
                })
            );

            const groupedResponse: Record<string, any[]> = {};

            for (const item of results) {
                const key = item.model_task_name || 'Others';
                if (!groupedResponse[key]) groupedResponse[key] = [];
                groupedResponse[key].push(item);
            }

            return groupedResponse;

        } catch (error) {
            console.error('Error in prepareQuery:', error);
            throw error;
        }
    }


    async prepareQueryById(param: ModelFilter): Promise<any> {
        try {
            console.log('Preparing query for model ID:', param);

            // Validate model ID
            if (!param.id || isNaN(Number(param.id))) {
                return Promise.reject('E10006');
            }
            let pprData: any = null;

            if (param.company_id) {
                const pprQuery = `
                    SELECT ppr.*
                    FROM v0_dev_yotta.company c
                    LEFT JOIN price_schema.price_plan_rule ppr
                        ON c.price_plan_id = ppr.price_plan_id
                    AND ppr.is_delete = 0
                    WHERE c.id = ${param.company_id}
                    AND c.is_delete = 0
                    AND ppr.resource_id = ${param.id}
                    LIMIT 1
                `;
                const dbConnection = Database.getInstance();
                const pprResult = await dbConnection.executeExternalQuery(pprQuery);
                pprData = pprResult?.[0] || null;
            }
            // Fetch the model entity by ID
            const modelEntity = await this.entity.findOne({
                where: { id: param.id, is_delete: 0 },
            });

            // Check if model exists
            if (!modelEntity) {
                return Promise.reject('E10029');
            }

            // Fetch related data in parallel
            const [
                modelLibraryData,
                modelCategoryData,
                modelTaskData,
                modelLicenseData,
                modelProviderData,
                sourceData,
                modelTypeData,
                modelAPIDetails,
                infraAllocationData,
                apiKeyTokenData,
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
                    select: ['language', 'steps'], // Only select required fields
                }),
                InfraAllocationEntity.findOne({ where: { module_id: modelEntity.id, is_delete: 0, module_type: InfraAllocationModuleType.MODEL }, select: ['node_id', 'module_id', 'module_type', 'model_endpoint', 'model_grpc'] }),
                ApiKeyTokenEntity.findOneBy({ generatedby_user_id: param.decryptToken.member_id, company_id: param.company_id, is_delete: 0, status: 1, is_playground_key: true })
            ]);

            // console.log('----------------- Related Data -----------------', apiKeyTokenData);


            // Ensure the playground token is still valid; regenerate if expired
            let playgroundToken = apiKeyTokenData ? apiKeyTokenData.generated_token : '';
            if (apiKeyTokenData) {
                const now = new Date();
                const isExpired = apiKeyTokenData.expiry_token_time && new Date(apiKeyTokenData.expiry_token_time) < now;
                if (isExpired || !playgroundToken) {
                    const freshToken = createjwt({
                        member_id: param.decryptToken.member_id,
                        email: param.decryptToken.email,
                        company_id: param.company_id,
                        role_id: 1
                    });
                    const newExpiry = new Date();
                    newExpiry.setDate(newExpiry.getDate() + 2);
                    await ApiKeyTokenEntity.update(
                        { id: apiKeyTokenData.id },
                        {
                            generated_token: freshToken,
                            generated_token_time: new Date(),
                            expiry_token_time: newExpiry,
                            status: 1
                        }
                    );
                    playgroundToken = freshToken;
                }
            }

            const normalizedTaskName = String(modelTaskData?.name || '').toLowerCase().replace(/[\s_-]+/g, '');
            const supportsAudioStreaming = Boolean(
                modelEntity?.enable_grpc
                && infraAllocationData?.model_grpc
                && infraAllocationData?.model_endpoint
                && normalizedTaskName === 'audiototext'
            );

            // Derive WSS streaming endpoint from the same model_endpoint base URL
            let audioStreamEndpoint = '';
            if (supportsAudioStreaming && infraAllocationData?.model_endpoint) {
                const baseUrl = String(infraAllocationData.model_endpoint).trim();
                // Replace protocol and path: https://host/inference/api/inference/api-key → wss://host/inference/api/inference/audio-stream
                audioStreamEndpoint = baseUrl
                    .replace(/^https?:\/\//i, (m) => m.startsWith('https') ? 'wss://' : 'ws://')
                    .replace(/\/api-key\/?$/, '/audio-stream');
            }

            // Construct the result object
            const model = {
                ...modelEntity, // Spread all model entity properties
                resource_type: pprData?.resource_type ?? null,
                tin: pprData?.tin ?? null,
                pin: pprData?.pin ?? null,
                tout: pprData?.tout ?? null,
                pout: pprData?.pout ?? null,
                c1: pprData?.c1 ?? null,
                c2: pprData?.c2 ?? null,
                c3: pprData?.c3 ?? null,
                gsec: pprData?.gsec ?? null,
                psec: pprData?.psec ?? null,
                library_name: modelLibraryData ? modelLibraryData.name : '',
                category_name: modelCategoryData ? modelCategoryData.name : '',
                license_name: modelLicenseData ? modelLicenseData.name : '',
                task_name: modelTaskData ? modelTaskData.name : '',
                provider_name: modelProviderData ? modelProviderData.name : '',
                source_name: sourceData ? sourceData.name : '',
                type_name: modelTypeData ? modelTypeData.name : '',
                api_details: modelAPIDetails.map((detail) => ({
                    language: detail.language,
                    steps: detail.steps,
                })) || [],
                infra_allocation_details: {
                    node_id: infraAllocationData?.node_id ?? null,
                    module_id: infraAllocationData?.module_id ?? null,
                    module_type: infraAllocationData?.module_type ?? null,
                    model_endpoint: infraAllocationData?.model_endpoint ?? null,
                    playground_token: playgroundToken
                },
                streaming: {
                    supported: supportsAudioStreaming,
                    protocol: 'websocket-pcm-v1',
                    endpoint: audioStreamEndpoint,
                    sampleRate: 16000,
                    channels: 1,
                    encoding: 'pcm_s16le',
                },
                model_session_key: CryptoJS.SHA256(
                    Date.now().toString() + Math.random().toString()
                ).toString(),
                model_task_icon: modelTaskData ? modelTaskData.model_task_icon ? await this.generateSignedUrl(
                    'modelTaskMedia',
                    modelTaskData.id,
                    modelTaskData.model_task_icon
                )
                    : '' : '',
                model_provider_icon: modelProviderData ? modelProviderData.model_provider_icon ? await this.generateSignedUrl(
                    'modelProviderMedia',
                    modelProviderData.id,
                    modelProviderData.model_provider_icon
                )
                    : '' : '',
                model_source_icon: sourceData ? sourceData.model_source_icon ? await this.generateSignedUrl(
                    'modelSourceMedia',
                    sourceData.id,
                    sourceData.model_source_icon
                )
                    : '' : '',
                model_licenses_icon: modelLicenseData ? modelLicenseData.model_licenses_icon ? await this.generateSignedUrl(
                    'modelLicenseMedia',
                    modelLicenseData.id,
                    modelLicenseData.model_licenses_icon
                )
                    : '' : '',
                model_category_icon: modelCategoryData ? modelCategoryData.model_category_icon ? await this.generateSignedUrl(
                    'modelCategoryMedia',
                    modelCategoryData.id,
                    modelCategoryData.model_category_icon
                )
                    : '' : '',
                model_libararies_icon: modelLibraryData ? modelLibraryData.model_libararies_icon ? await this.generateSignedUrl(
                    'modelLibarariesMedia',
                    modelLibraryData.id,
                    modelLibraryData.model_libararies_icon
                )
                    : '' : '',
                signedUrl_model_image: modelEntity.model_image
                    ? await this.generateSignedUrl('modelImages', modelEntity.id, modelEntity.model_image)
                    : '',
                model_dos: [],
            };

            if (modelEntity.model_docs_ids && modelEntity.model_docs_ids.length > 0) {
                const db = Database.getInstance();
                const docsQuery = `
                    SELECT id, name, short_desc, image_path, link
                    FROM docs_tbl
                    WHERE id = ANY($1) AND is_delete = 0
                `;
                const docsResult = await db.executeExternalQuery(docsQuery, [modelEntity.model_docs_ids]);
                model.model_dos = Array.isArray(docsResult) ? (Array.isArray(docsResult[0]) ? docsResult[0] : docsResult) : [];
            }

            return {
                data: model,
                success: true,
                message: 'Model retrieved successfully',
            };
        } catch (error) {
            console.error('Error in prepareQueryById:', error);
            throw error;
        }
    }
}

export default ModelClassService;
