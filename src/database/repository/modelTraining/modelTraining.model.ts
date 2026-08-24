import { ModelTrainingStatus } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class ModelTrainingModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    model_id: number = 0;
    name: string = '';
    description: string = '';
    model_category_id: number = 0;
    dataset_id: number = 0;
    data_set_id: number = 0;
    train_configuration: any = null;
    model_task_type_id: number = 0;
    dataset_configuration: any = null;
    infra_allocation_id: number = 0;
    request_id: string = '';
    job_id: string = '';
    execution_time: number = 0;
    status: ModelTrainingStatus = ModelTrainingStatus.PENDING;
    data_set_details: any = null;
    decryptToken: any = null;
    infra_detail: any = null;
    training_type: string = 'Supervised';
    accelerator_id: number = null;
    accelerator_count: number = 1;
    cloud_provider_id: number = null;
    evaluation_details: any = null;
    deployment_details: any = null;
    training_id: number = null;
    latest_kafka_message: any = null;
    status_log: any[] = [];
}

