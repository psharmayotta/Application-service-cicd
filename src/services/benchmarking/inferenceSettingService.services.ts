import { IsNull } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { BenchmarkingDto } from "../../database/repository/benchmarking/benchmarking.dto";
import { BenchmarkingModel } from "../../database/repository/benchmarking/benchmarking.model";
import { BenchmarkingEntity } from "../../entities/benchmarkingEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { BaseServices } from "../baseService.services";

export class InferenceSettingService extends BaseServices {
    constructor(entity: any = BenchmarkingEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): BenchmarkingModel {
        return new BenchmarkingModel();
    }

    getDTO(): any {
        return BenchmarkingDto;
    }

    getModuleName(): string {
        return "Inference Setting";
    }

    async getInferenceSettingsByModel(body: any): Promise<any> {
        const { base_model_id, model_type, model_class } = body;
        try {
            const model = await ModelEntity.findOne({
                where: { id: base_model_id, is_delete: 0 }
            });
            if (model && model_type) {
                if (model_type === 'PLAYGROUND') {
                    return { inference_settings: model.playground_config };
                } else if (model_type === 'MYMODEL') {
                    if (model.model_class_id) {
                        const finalModel = await ModelEntity.findOne({
                            where: {
                                model_class_id: model.model_class_id,
                                member_id: IsNull(),
                                company_id: IsNull(),
                                is_delete: 0
                            },
                            order: {
                                id: "ASC"
                            }
                        });
                        if (finalModel) {
                            return { inference_settings: finalModel.playground_config };
                        }
                    }
                }

                // Default fallback if model_type is not recognized
                if (model.playground_config && model.playground_config.length > 0) {
                    return { inference_settings: model.playground_config };
                }
            } else {
                const finalModel = await ModelEntity.findOne({
                    where: {
                        model_class_id: model_class,
                        member_id: IsNull(),
                        company_id: IsNull(),
                        is_delete: 0
                    },
                    order: {
                        id: "ASC"
                    }
                });
                if (finalModel) {
                    return { inference_settings: finalModel.playground_config };
                }
            }
            return { inference_settings: null };
        } catch (error) {
            console.error('Error in getInferenceSettingsByModel:', error);
            throw error;
        }
    }
}
