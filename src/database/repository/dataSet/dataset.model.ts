import { DatasetFormat, DatasetType } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";


export class DataSetModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    name: string = '';
    description: string = '';
    cloud_service_id: number = 0;
    dataset_path: string | null = null;
    cloud_secret_id: number | null = null;
    region_id: number | null = null;
    type: DatasetType = DatasetType.json; // default example
    uri: string | null = null;
    data_format: DatasetFormat = DatasetFormat.OpenAI; // default example
    meta_data: any = null;
    download_status: boolean = false;
    yotta_bucket_path: string | null = null;
    size: string | null = null;
    failure_message: string | null = null;
    decryptToken: any = null;
    status: string | null = null;
    module_name: string = null;
    category_id: number = null;
}
