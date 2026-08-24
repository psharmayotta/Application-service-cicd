import { CloudAccountOwnership } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class CloudAccountModel extends InferModel {
    account_name: string = '';
    company_id: number = null;
    member_id: number = null;
    cloud_provider_id: number = null;
    cloud_region_id: number = null;
    cloud_secret_id: number = null;
    ownership: CloudAccountOwnership = CloudAccountOwnership.PRIVATE;
    status: boolean = true;
    decryptToken: { member_id?: number, email?: string } = {}
}
