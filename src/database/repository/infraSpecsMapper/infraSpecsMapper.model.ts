import { InferModel } from "../InferModel/InferModel.model";

export class InfraSpecsMapperModel extends InferModel {
    node_id: number = null;
    hardware_specs_id: number = null;
    config_date: Date = null;
    notes: string = '';
    os: string = '';
}