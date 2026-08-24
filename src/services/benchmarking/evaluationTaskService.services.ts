import { EvaluationTaskEntity } from "../../entities/evaluationTaskEntity";
import { EvaluationTaskDto } from "../../database/repository/evaluationTask/evaluationTask.dto";
import { BenchmarkingDatasetEntity } from "../../entities/benchmarkingDatasetEntity";
import { EvaluationTaskModel } from "../../database/repository/evaluationTask/evaluationTask.model";
import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { Pagination } from "../../core/InferParams";
import { MetaModel } from "../../core/MetaModel";

class EvaluationTaskService extends BaseServices {
    constructor(entity: any = EvaluationTaskEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): EvaluationTaskModel {
        return new EvaluationTaskModel();
    }

    getDTO(): any {
        return EvaluationTaskDto;
    }

    getModuleName(): string {
        return "Evaluation Task";
    }

    getMetaModel(): MetaModel {
        return new MetaModel("evaluationTasks", "icon", [
            {
                fileKey: "icon",
                allowedSize: 1048576, // 1MB
                allowedExtensions: ["png", "jpg", "jpeg", "svg", "webp", "ico"],
                colName: "icon",
                require: "false",
            },
        ]);
    }

    prepareFilter(param: any): any {
        const filter: any = { where: { is_delete: 0 }, order: { created_at: 'DESC' } };
        if (param.category_id) {
            filter.where.category_id = param.category_id;
        }
        return filter;
    }

    override async prepareQuery(param: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                let skip = 0;
                if (param.pageNumber > 0) {
                    skip = (param.pageNumber - 1) * param.pageSize;
                }

                const qb = this.entity.createQueryBuilder("et")
                    .where("et.is_delete = 0");

                if (param.category_id) {
                    qb.andWhere("et.category_id = :category_id", { category_id: param.category_id });
                }

                qb.orderBy("et.created_at", "DESC")
                    .offset(skip)
                    .limit(param.pageSize || 25);

                const [data, total] = await Promise.all([
                    qb.getMany(),
                    qb.getCount()
                ]);

                const updatedData = await Promise.all(
                    data.map(async (item) => {
                        if (item.icon) {
                            item.icon = await this.generateSignedUrl("evaluationTasks", item.id, item.icon);
                        }
                        return item;
                    })
                );

                resolve({
                    data: updatedData,
                    pagination: {
                        total,
                        pageSize: param.pageSize || 25,
                        pageNumber: param.pageNumber || 0
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    override async prepareQueryById(id: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const data = await this.entity.createQueryBuilder("et")
                    .where("et.id = :id", { id })
                    .andWhere("et.is_delete = 0")
                    .getOne();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    }

    async postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        if (Array.isArray(result)) {
            for (const record of result) {
                if (record.icon) {
                    record.icon = await this.generateSignedUrl("evaluationTasks", record.id, record.icon);
                }
            }
        }
        return result;
    }

    async postProcessAfterGetById(result: any): Promise<any> {
        if (result && result.icon) {
            result.icon = await this.generateSignedUrl("evaluationTasks", result.id, result.icon);
        }
        return result;
    }

    async postProcessAfterGetAll(result: any): Promise<any> {
        return this.postProcessAfterGetData(result, null);
    }

    async postProcessGetById(result: any): Promise<any> {
        return this.postProcessAfterGetById(result);
    }
}

export default EvaluationTaskService;
