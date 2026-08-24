import { HardwareComponentType, StorageType } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class HardwareSpecsModel extends InferModel {
    component_type: HardwareComponentType = null;
    model_name: string = '';
    manufacturer: string = '';
    core_count: number = null;
    thread_count: number = null;
    clock_speed_ghz: number = null;
    vram_size_gb: number = null;
    vram_type: string = '';
    storage_capacity_gb: number = null;
    storage_type: StorageType = null;
    interface: string = '';
    tdp_watt: number = null;
    release_year: number = null;
    extra_specs: number = null;
    vlan_id: string = '';
    zone_id: number = null;
    region_id: number = null;
    cloud_provider_id: number = null;
}