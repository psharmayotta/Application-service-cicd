import { InferModel } from "../InferModel/InferModel.model";

export class Model extends InferModel {

    name: string = null;
    version: string = null;
    model_libararies_id: number = null;
    model_category_id: number = null;
    description: string = null;
    playground_config: Array<any> = null;
    model_gpu_id: number = null;
    model_train_configuration: Array<any> = null;
    model_task_id: number = null;
    model_licenses_id: number = null;
    model_provider_id: number = null;
    model_source_id: number = null;
    model_source_repo: string = null;
    model_detail: string = null;
    model_type_id: number = null;
    allow_training: boolean = null;
    allow_playground: boolean = null;
    model_suggestion: string = null;
    model_rank: number = null;
    model_input: any[] = null;
    model_output: any[] = null;
    popular_models: number = null;
    new_models: number = null;
    input_tokens: string = null;
    output_tokens: string = null;
    contex: number = null;
    parameters: number = null;
    is_suggetion: boolean = false;
    supported_features: any = null;
    input_data_format_support: any[] = null;
    output_data_format_support: any[] = null;
    supported_languages: any[] = null;
    model_developer_and_architecture: any = null;
    new_models_due_date: Date = null;
    per_image_tokens: string = null;
    model_docs_ids: Array<number> = null;
}
