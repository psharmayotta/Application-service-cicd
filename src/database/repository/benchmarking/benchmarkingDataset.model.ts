import { InferModel } from "../InferModel/InferModel.model";

export class BenchmarkingDatasetModel extends InferModel {
    dataset_name: string = "";
    purpose: string = "";
    size: string = "";
    category_id: number = 0;
    evaluation_task_id: number = null;
}
