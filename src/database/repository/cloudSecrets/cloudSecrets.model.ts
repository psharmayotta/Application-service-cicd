import { InferModel } from "../InferModel/InferModel.model";

export class CloudSecretsModel extends InferModel {
    name: string = '';
    c_provider_id: string = '';
    cloud_services_id: string = '';
    secrets: any = '';
    company_id: string = '';
    member_id: string = '';
    status: boolean = false;
    decryptToken: any = null;
    last_used_at: Date = null;
    last_used_by_module: string = null;
}
