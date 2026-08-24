import { InfraNodesStatus } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class InfraNodesModel extends InferModel {
    hostname: string = '';
    location: string = '';
    rack_id: number = null;
    region_id: number = null;
    ip_address: string = '';
    mac_address: string = '';
    serial_number: string = '';
    status: InfraNodesStatus = InfraNodesStatus.AVAILABLE;
    owner_project_id: number = null;
    provisioned_by: number = null;
    zone_id: number = null;
    cloud_provider_id: number = null;
    hardware_specs_ids: number[] = null;
    mobileExist: any = null;
    is_reserved :boolean =false;
}