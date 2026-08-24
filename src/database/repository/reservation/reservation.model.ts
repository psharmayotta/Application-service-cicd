import { InferModel } from "../InferModel/InferModel.model";

export class ReservationModel extends InferModel {
    infra_node_id: number = null;
    accelerator_count: number = null;
    region_id: number = null;
    start_date: Date = null;
    end_date: Date = null;
    member_id: number = null;
    decryptToken: any = null;
    status: string = 'pending';
    created_by: number = null;
    company_id: number = null;
}

