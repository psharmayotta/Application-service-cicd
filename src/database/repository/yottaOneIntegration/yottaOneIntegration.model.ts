import { InferModel } from "../InferModel/InferModel.model";

export class YottaOneIntegrationModel extends InferModel {
    // User fields
    user: any = null;
    username: string = '';
    password: string = '';

    // Flat user fields (OneYotta external format)
    user_email: string = '';
    user_fname: string = '';
    user_lname: string = '';
    user_mobile_no: string = '';
    user_account_id: string = '';
    user_status: string = '';
    user_contact_status: string = '';
    user_contact_crmid_uuid: string = '';
    user_contact_type: any = null;
    user_contact_crmid: string = '';
    user_roles: any = null;
    user_id: string = '';
    user_is_org: number = 0;
    source: string = '';
    defaultUser: boolean = false;

    // Organization fields
    organizationName: string = '';
    organization_name: string = '';
    name: string = '';
    company_name: string = '';
    companyName: string = '';
    description: string = '';

    // External identifiers
    external_customer_id: string = '';

    // Email fields
    work_email: string = '';
    workEmail: string = '';
    company_email: string = '';
    companyEmail: string = '';

    // KYC
    isKYC: boolean = false;
    is_kyc: boolean = false;

    // Industry
    industry: string = '';

    // Address
    billing_address: any = null;

    // Metadata
    metadata: any = null;
}
