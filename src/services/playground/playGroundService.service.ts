import { In } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { PlaygroundDto } from "../../database/repository/playground/playground.dto";
import { PlaygroundModel } from "../../database/repository/playground/playground.model";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { BaseServices } from "../baseService.services";
import { EncryptionAndDecryption } from "../../core/Encryption&Decryption";

class PlaygroundService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): PlaygroundModel {
        return new PlaygroundModel();
    }

    getDTO(): any {
        return PlaygroundDto;
    }

    getModuleName(): string {
        return 'Playground';
    }


    async prepareQuery(param: Pagination): Promise<any[]> {
        try {
            const modelEntities = await this.entity.find({
                where: {
                    is_delete: 0,
                    allow_playground: true,
                    // Ensure model.id exists in InfraAllocationEntity.model_id
                    id: In(
                        await InfraAllocationEntity.find({
                            select: ['module_id'],
                            where: { is_delete: 0 }
                        }).then(allocations => allocations.map(a => a.module_id))
                    )
                },
                order: { model_rank: 'ASC' }
            });

            return Promise.all(modelEntities.map(async (model: any) => {
                const model_provider = await ModelProviderEntity.findOneBy({ id: model.model_provider_id, is_delete: 0 });
                const task_entity = await ModelTaskEntity.findOneBy({ id: model.model_task_id, is_delete: 0 });
                const model_category = await ModelCategoryEntity.findOneBy({ id: model.model_category_id, is_delete: 0 });

                return {
                    is_new: model.new_models,
                    id: model.id,
                    name: model.name,
                    model_provider_icon: model_provider
                        ? model_provider.model_provider_icon
                            ? await this.generateSignedUrl(
                                'modelProviderMedia',
                                model_provider.id,
                                model_provider.model_provider_icon
                            )
                            : ''
                        : '',
                    task_name: task_entity ? task_entity.name : null,
                    model_category: model_category ? model_category.name : null,
                    description: model.description
                };
            })).then(results => results.filter(Boolean));
        } catch (error) {
            console.error('Error in prepareQuery:', error);
            throw error;
        }
    }

    async getPlaygroundModelsInfo(): Promise<any[]> {
        try {
            const modelEntities = await this.entity.find({
                where: {
                    is_delete: 0,
                    allow_playground: true,
                    id: In(
                        await InfraAllocationEntity.find({
                            select: ['module_id'],
                            where: { is_delete: 0 }
                        }).then(allocations => allocations.map(a => a.module_id))
                    )
                },
                order: { model_rank: 'ASC' }
            });

            return modelEntities.map((model: any) => {
                return {
                    model_name: model.name,
                    encrypted_model_id: EncryptionAndDecryption.encryptionIds(model.id)
                };
            });
        } catch (error) {
            console.error('Error in getPlaygroundModelsInfo:', error);
            throw error;
        }
    }
}

export default PlaygroundService;