import { AwsService } from "../../core/AwsService";
import { BenchmarkingDatasetDto } from "../../database/repository/benchmarking/benchmarkingDataset.dto";
import { BenchmarkingDatasetModel } from "../../database/repository/benchmarking/benchmarkingDataset.model";
import { BenchmarkingDatasetEntity } from "../../entities/benchmarkingDatasetEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { BaseServices } from "../baseService.services";

class BenchmarkingDatasetService extends BaseServices {
    constructor(entity: any = BenchmarkingDatasetEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): BenchmarkingDatasetModel {
        return new BenchmarkingDatasetModel();
    }

    getDTO(): any {
        return BenchmarkingDatasetDto;
    }

    getModuleName(): string {
        return "Benchmarking Dataset";
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const queryBuilder = this.entity
                .createQueryBuilder("bd")
                .select([
                    "bd.id AS id",
                    "bd.dataset_name AS dataset_name",
                    "bd.purpose AS purpose",
                    "bd.size AS size",
                    "bd.category_id AS category_id",
                    "bd.evaluation_task_id AS evaluation_task_id",
                    "mc.name AS category_name"
                ])
                .leftJoin(ModelCategoryEntity, "mc", "mc.id = bd.category_id")
                .where("bd.is_delete = 0");

            if (param.category_id) {
                queryBuilder.andWhere("bd.category_id = :categoryId", { categoryId: param.category_id });
            }

            if (param.evaluation_task_id) {
                queryBuilder.andWhere("bd.evaluation_task_id = :taskId", { taskId: param.evaluation_task_id });
            }

            const result = await queryBuilder.getRawMany();
            return Promise.resolve(result);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    async getSampleDatasetUrl(): Promise<string> {
        return "http://d1xwsof81svk9i.cloudfront.net/benchmarking/custom_dataset_samples.zip";
    }
}

export default BenchmarkingDatasetService;
