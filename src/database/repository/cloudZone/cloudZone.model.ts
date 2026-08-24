import { InferModel } from "../InferModel/InferModel.model";

export class CloudZoneModel extends InferModel {
    c_provider_id: number = null;
    name: string = '';
    cloud_zone_code: string = '';
    status: boolean = true;
}