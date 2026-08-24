import { BatchInferenceJobEntity } from "../../entities/batchInferenceJobEntity";
import { BatchInferenceEntity } from "../../entities/batchInferenceEntity";
import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { BatchInferenceJobModel } from "../../database/repository/batchInferenceJob/batchInferenceJob.model";
import { BatchInferenceJobDto } from "../../database/repository/batchInferenceJob/batchInferenceJob.dto";

export class BatchInferenceJobService extends BaseServices {
    constructor() {
        super(BatchInferenceJobEntity as any, new AwsService());
    }

    getModel(): BatchInferenceJobModel {
        return new BatchInferenceJobModel();
    }

    getDTO(): any {
        return BatchInferenceJobDto;
    }

    getModuleName(): string {
        return "BatchInferenceJob";
    }

    override transformModel(model: BatchInferenceJobModel): BatchInferenceJobModel {
        // Any specific transformations required before saving
        return model;
    }

    async prepareQuery(param: any): Promise<any> {
        try {
            const queryBuilder = (this.entity as typeof BatchInferenceJobEntity)
                .createQueryBuilder("job")
                .where("job.is_delete = :isDelete", { isDelete: param.is_delete ?? 0 })
                .orderBy("job.created_at", "DESC");

            if (param.batch_inference_id) {
                queryBuilder.andWhere("job.inference_id = :inferenceId", { inferenceId: param.batch_inference_id });
            }

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                queryBuilder.offset(offset);
                queryBuilder.limit(param.pageSize);
            }

            const [data, total] = await Promise.all([
                queryBuilder.getMany(),
                queryBuilder.getCount()
            ]);

            return {
                data,
                pagination: {
                    total,
                    pageSize: param.pageSize,
                    pageNumber: param.pageNumber,
                }
            };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async prepareQueryById(param: any): Promise<any> {
        try {
            if (!param.id) return Promise.reject('E10006');

            const record = await (this.entity as typeof BatchInferenceJobEntity)
                .createQueryBuilder("job")
                .leftJoinAndSelect(BatchInferenceEntity, "inference", "inference.id = job.inference_id")
                .select([
                    "job.id AS id",
                    "job.inference_id AS inference_id",
                    "job.status AS status",
                    "job.result AS result",
                    "job.configuration AS configuration",
                    "job.report_path AS report_path",
                    "job.created_at AS created_at",
                    "inference.name AS inference_name",
                    "inference.dataset_id AS dataset_id"
                ])
                .where("job.id = :id", { id: param.id })
                .andWhere("job.is_delete = 0")
                .getRawOne();

            if (!record) return Promise.reject('E10001');

            return record;
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
