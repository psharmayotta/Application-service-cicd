import { InferModel } from "../InferModel/InferModel.model";

export class CompanyMemberRolesModel extends InferModel {
    company_id: number | null = null;
    member_id: number | null = null;
    role_id: number | null = null;
    default_company: boolean | null = null;
    active: boolean | null = true;
    decryptToken: any = null;
    is_access_active: boolean = true;
    invite_id: number | null = null;
}
