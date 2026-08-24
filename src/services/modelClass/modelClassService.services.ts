import { In, IsNull } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { ModelClassDto } from "../../database/repository/modelClass/modelClass.dto";
import { ModelClass } from "../../database/repository/modelClass/modelClass.model";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelQuantizationMapper } from "../../entities/modelQuantizationMapper";
import { QuantizationEntity } from "../../entities/quantizationEntity";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { BaseServices } from "../baseService.services";

class ModelClassService extends BaseServices {
    constructor(entity: any = ModelClassEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModelClass {
        return new ModelClass()
    }

    getDTO(): any {
        return ModelClassDto;
    }

    getModuleName(): string {
        return 'Model Class';
    }

    async postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        try {
            if (!result || !Array.isArray(result) || result.length === 0) {
                return result;
            }

            const modelClassIds = result.map((record: any) => record.id);

            // Find one model per model_class_id where company_id is null and is_delete = 0
            const models = await ModelEntity.find({
                where: {
                    model_class_id: In(modelClassIds),
                    company_id: IsNull(),
                    is_delete: 0,
                },
                select: ['model_class_id', 'model_category_id'],
            });

            // Build a map of model_class_id -> model_category_id (first match)
            const categoryMap = new Map<number, number>();
            for (const model of models) {
                if (!categoryMap.has(model.model_class_id)) {
                    categoryMap.set(model.model_class_id, model.model_category_id);
                }
            }

            // Enrich each model class record with category_id
            return result.map((record: any) => ({
                ...record,
                category_id: categoryMap.get(record.id) || null,
            }));
        } catch (error) {
            console.error('Error in postProcessAfterGetData for ModelClass:', error);
            return result;
        }
    }

    async prepareQueryById(param: Pagination): Promise<any> {
        try {
            console.log('Preparing query for model ID:', param);
            if (!param.id) {
                throw new Error('Model ID is required');
            }
            const modelEntity = await this.entity.findOne({
                where: { id: param.id, is_delete: 0 },
            });
            if (!modelEntity) {
                throw new Error('Model not found');
            }
            const modelClassMapperData = await ModelQuantizationMapper.find({
                where: { model_class_id: modelEntity.id, is_delete: 0 }
            });
            const quantizationIds = modelClassMapperData.map(mapper => mapper.quantization_id);
            const quantizationEntities = await QuantizationEntity.find({
                where: {
                    id: In(quantizationIds),
                    is_delete: 0
                },
                select: ['id', 'name', 'short_description', 'precision','optimization_configuration', 'model_configuration', 'pipeline_configuration'],
            });
            return {
                ...modelEntity,
                quantizationIds: quantizationEntities
            };
        } catch (error) {
            
            console.error('Error in prepareQueryById:', error);
            throw error;
        }
    }
}

export default ModelClassService;