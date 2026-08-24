import { InferModel } from "../InferModel/InferModel.model";

export class HostedZoneModel extends InferModel {
    hosted_zone_name: string = null;
    company_id: number = null;
    member_id: number = null;
    cloud_account_id: number = null;
    sub_domain: string = null;
    domain: string = null;
    full_domain: string = null;
    zone_id: string = null;
    status: boolean = false;
    decryptToken: { member_id?: number, email?: string } = {}
}
