import { IsNull } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { ModelFilter } from "../../core/InferParams";
import { ModelDto } from "../../database/repository/model/model.dto";
import { Model } from "../../database/repository/model/model.model";
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

class ModelTrainingListingService extends BaseServices {
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

    async prepareQuery(param: ModelFilter): Promise<any[]> {
        try {
            // Base filter
            const where: any = {
                is_delete: 0,
                member_id: IsNull(),
                company_id: IsNull(),
            };

            if (param.model_category_id) {
                where.model_category_id = param.model_category_id;
            }

            if (param.model_task_id) {
                where.model_task_id = param.model_task_id;
            }

            if (param.allow_training) {
                where.allow_training = param.allow_training;
            }

            const modelEntities = await this.entity.find({
                where,
                order: { model_rank: 'ASC' }
            });
            // Map each model entity to its related data
            const results = await Promise.all(
                modelEntities.map(async (modelEntity) => {
                    // Fetch related data for the current model entity in parallel
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
                        ModelLibarariesEntity.findOneBy({ id: modelEntity.model_libararies_id, is_delete: 0 }), // Fixed typo
                        ModelCategoryEntity.findOneBy({ id: modelEntity.model_category_id, is_delete: 0 }),
                        ModelTaskEntity.findOneBy({ id: modelEntity.model_task_id, is_delete: 0 }),
                        ModelLicensesEntity.findOneBy({ id: modelEntity.model_licenses_id, is_delete: 0 }),
                        ModelProviderEntity.findOneBy({ id: modelEntity.model_provider_id, is_delete: 0 }),
                        SourceEntity.findOneBy({ id: modelEntity.model_source_id, is_delete: 0 }),
                        ModelTypeEntity.findOneBy({ id: modelEntity.model_type_id, is_delete: 0 }),
                        ModelAPIDetailsEntity.findBy({ model_id: modelEntity.id, is_delete: 0 }),
                    ]);
                    const result = {
                        ...modelEntity, // Spread the model entity properties
                        model_category_name: modelCategoryData ? modelCategoryData.name : '',
                        model_libraries_name: modelLibraryData ? modelLibraryData.name : '',
                        model_licenses_name: modelLicenseData ? modelLicenseData.name : '',
                        model_task_name: modelTaskData ? modelTaskData.name : '',
                        model_provider_name: modelProviderData ? modelProviderData.name : '',
                        model_source_name: sourceData ? sourceData.name : '',
                        model_type_name: modelTypeData ? modelTypeData.name : '',
                        model_api_details: modelAPIDetails || [],
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
                        model_libararies_icon: modelLibraryData ? modelLibraryData.model_libararies_icon ? await this.generateSignedUrl(
                            'modelLibarariesMedia',
                            modelLibraryData.id,
                            modelLibraryData.model_libararies_icon
                        )
                            : '' : '',
                        signedUrl_model_image: modelEntity.model_image
                            ? await this.generateSignedUrl(
                                'modelImages',
                                modelEntity.id,
                                modelEntity.model_image
                            )
                            : '',
                    };

                    return result;
                })
            );

            return results;
        } catch (error) {
            console.error('Error in prepareQuery:', error);
            throw error;
        }
    }
}

export default ModelTrainingListingService;