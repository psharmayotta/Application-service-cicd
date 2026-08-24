import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { MetaModel } from "../../core/MetaModel";
import { ModelCategoryDto } from "../../database/repository/modelCategory/modelCategory.dto";
import { ModelCategory } from "../../database/repository/modelCategory/modelCategory.model";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { BaseServices } from "../baseService.services";

class ModelCategoryService extends BaseServices {
    constructor(entity: any = ModelCategoryEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModelCategory {
        return new ModelCategory()
    }

    getDTO(): any {
        return ModelCategoryDto;
    }

    getModuleName(): string {
        return 'Model Category';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('modelCategoryMedia', 'model_category_icon', [{ fileKey: "model_category_icon", allowedSize: 5767168, require: "true", allowedExtensions: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'], colName: "model_category_icon" }])
    }

    override async transformFileData(model: ModelCategory, files: any): Promise<any> {
        try {
            let fileData = null
            if (files.length > 0) {
                fileData = {
                    ...model,
                    model_category_icon: files[0].model_category_icon
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


    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            const query = this.entity
                .createQueryBuilder('mc')
                .select('mc.*')
                .distinct(true)
                .innerJoin(ModelEntity, 'm', 'm.model_category_id = mc.id')
                .where('m.is_delete = 0')
                .andWhere('mc.is_delete = 0');

            if ((param as any).is_benchmarking === true) {
                query.andWhere('mc.is_benchmarking = true');
            } else {
                query.andWhere('m.allow_training = true');
            }

            const result = await query
                .orderBy('mc.created_at', 'DESC')
                .getRawMany();

            for (const item of result) {
                if (item.model_category_icon && item.model_category_icon.trim() !== "") {

                    if (
                        item.model_category_icon.startsWith("http://") ||
                        item.model_category_icon.startsWith("https://")
                    ) {
                        item.model_category_icon = item.model_category_icon;
                    } else {
                        try {
                            item.model_category_icon = await this.generateSignedUrl(
                                "modelCategoryMedia",
                                item.id,
                                item.model_category_icon
                            );
                        } catch {
                            item.model_category_icon = null;
                        }
                    }

                } else {
                    item.model_category_icon = null;
                }
            }

            return Promise.resolve(result);

        } catch (error) {
            console.log('------ModelCategoryService.prepareQuery----------', error);
            return Promise.reject(error);
        }
    }

}

export default ModelCategoryService;