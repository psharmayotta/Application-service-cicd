import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { MetaModel } from "../../core/MetaModel";
import { ModelTaskDto } from "../../database/repository/modelTask/modelTask.dto";
import { ModelTask } from "../../database/repository/modelTask/modelTask.model";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { BaseServices } from "../baseService.services";

class ModelTaskService extends BaseServices {
    constructor(entity: any = ModelTaskEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModelTask {
        return new ModelTask()
    }

    getDTO(): any {
        return ModelTaskDto;
    }

    getModuleName(): string {
        return 'Model Task';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('modelTaskMedia', 'model_task_icon', [{ fileKey: "model_task_icon", allowedSize: 5767168, require: "true", allowedExtensions: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'], colName: "model_task_icon" }])
    }

    override async transformFileData(model: ModelTask, files: any): Promise<any> {
        try {
            let fileData = null
            if (files.length > 0) {
                fileData = {
                    ...model,
                    model_task_icon: files[0].model_task_icon
                }
            } else {
                fileData = {
                    ...model,
                    files
                }
            }

            return Promise.resolve(fileData)
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async prepareQuery(param: any): Promise<any> {
        try {
            let modelTaskData: any[] = []
            if (param.model_category_id !== undefined && param.model_category_id !== null && param.model_category_id !== 0) {
                modelTaskData = await this.entity
                    .createQueryBuilder('mt')
                    .select('mt.*')
                    .distinct(true)
                    .innerJoin(ModelEntity, 'm', 'm.model_task_id = mt.id')
                    .innerJoin(ModelCategoryEntity, 'mc', 'mc.id = mt.model_category_id')
                    .where('m.is_delete = 0')
                    .andWhere('mt.model_category_id = :ModelCategoryId', { ModelCategoryId: param.model_category_id })
                    .andWhere('mc.is_delete = 0')
                    .andWhere('mt.is_delete = 0')
                    .andWhere('m.allow_training = true')
                    .orderBy('mt.created_at', 'DESC')
                    .getRawMany();
            } else {
                modelTaskData = await this.entity.findBy({ is_delete: 0 })
            }

            for (const item of modelTaskData) {
                if (item.model_task_icon && item.model_task_icon.trim() !== "") {

                    if (
                        item.model_task_icon.startsWith("http://") ||
                        item.model_task_icon.startsWith("https://")
                    ) {
                        // already full url
                        item.model_task_icon = item.model_task_icon;

                    } else {
                        try {
                            const signedUrl = await this.generateSignedUrl(
                                "modelTaskMedia",
                                item.id,
                                item.model_task_icon
                            );
                            item.model_task_icon = signedUrl;
                        } catch {
                            item.model_task_icon = null;
                        }
                    }

                } else {
                    item.model_task_icon = null;
                }
            }

            const totalRecords = modelTaskData.length > 0 ? modelTaskData.length : 0
            return Promise.resolve({ records: modelTaskData, totalRecords });
        } catch (error) {
            console.log('-----------error---------', error);
            return Promise.reject(error);

        }
    }

}

export default ModelTaskService;