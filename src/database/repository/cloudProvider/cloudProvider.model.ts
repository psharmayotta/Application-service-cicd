import { InferModel } from "../InferModel/InferModel.model";

export class CloudProviderModel extends InferModel {
    name: string = null;
    cloud_code: string = null;
    status: boolean = true;
    secret_template: any = null;
    cloud_account_activation: boolean = true;
    cloud_secret_activation: boolean = true;
    benchmarking_activation: boolean = true;
    cloud_provider_image: string = null;
    rag_activation: boolean = true;
}
