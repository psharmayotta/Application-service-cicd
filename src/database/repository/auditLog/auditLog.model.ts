import { InferModel } from "../InferModel/InferModel.model";

export class AuditLogModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    module: string = '';
    action: string = '';
    entity_type: string = '';
    entity_id: number = null;
    entity_name: string = '';
    description: string = '';
    metadata: any = {};
    ip_address: string = '';
    decryptToken: any = null;
}
