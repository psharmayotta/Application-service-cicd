import { CloudServiceType } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class CloudServicesModel extends InferModel {
    c_provider_id: number = null;
    name: string = '';
    service_type: CloudServiceType
    status: boolean = true;
}