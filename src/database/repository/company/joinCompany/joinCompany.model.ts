import { InferModel } from "../../InferModel/InferModel.model";

export class JoinCompanyModel extends InferModel {
    company_unique_code: string;
    company_id: number;
    member_id: number;
    role_id: number;
    active: boolean;
    default_company: boolean;
    company_unique_id: string = '';
    decryptToken: { member_id?: number, email?: string } = {};

    constructor() {
        super();
        this.company_unique_code = '';
        this.company_id = 0;
        this.member_id = 0;
        this.role_id = 0;
        this.active = true;
        this.default_company = false;
    }
}
