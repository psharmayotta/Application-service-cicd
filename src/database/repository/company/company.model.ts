import { InferModel } from "../InferModel/InferModel.model";

export class CompanyModel extends InferModel {
    company_name: string = '';
    industry: string = '';
    company_email: string = '';
    company_unique_code: string = ''
    is_active: boolean = true;
    member_id: number | null = null;
    role_id: number | null = null;
    default_company: boolean | null = null;
    active: boolean | null = true;
    decryptToken: any = null;
    price_plan_id: number | null = null;
    company_unique_id: string = '';
    created_by: number | null = null;
}