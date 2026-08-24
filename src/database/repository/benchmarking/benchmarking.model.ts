import { InferModel } from "../InferModel/InferModel.model";
import { BenchmarkingType } from "../../../config";

export class BenchmarkingModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    cloud_secret_id_1: number = 0;
    cloud_secret_id_2: number = 0;
    name: string = "";
    description: string = "";
    benchmarking_type: BenchmarkingType = null;
    model_category_id: number = 0;
    model_source_id: number = 0;
    model_2_source_id: number = 0;
    model_path: string = "";
    model_2_path: string = "";
    model_class_id: number = 0;
    model_2_class_id: number = null;
    model_type: string = "";
    model_2_type: string = "";
    base_model: number = 0;
    base_model_2: number = null;
    dataset_id: any = [];
    concurrent_users: number[] = [];
    gpu_type: number = 0;
    gpu_count_per_node: number = 0;
    hardware_1_gpu_type: number = 0;
    hardware_1_gpu_count_per_node: number = 0;
    hardware_2_gpu_type: number = 0;
    hardware_2_gpu_count_per_node: number = 0;
    inference_setting: any = null;
    inference_setting2: any = null;
    base_model_1_category: string = "";
    base_model_2_category: string = "";
    ai_model: number = 0;
    prompt: string = "";
    status: string = "Pending";
    results_1: any = null;
    results_2: any = null;
    decryptToken: any = null;
    model_1_status: string = "Pending";
    model_2_status: string = "Pending";

    // For MODEL_EVALUATION type
    evaluation_task_id: number | null = null; // Single evaluation task ID

    knowledgebase_id: number | null = null;
}
