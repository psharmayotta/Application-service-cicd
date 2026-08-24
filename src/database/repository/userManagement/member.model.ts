import { InferModel } from "../InferModel/InferModel.model";

export class MemberModel extends InferModel {
    company_id: number = 0;
    email: string = '';
    full_name: string = '';
    role_id: number = 0;
    profile_picture: string = '';
    last_login: Date = null;
    is_active: boolean = true;
    email_verification_pending: boolean = true;
    profile_complete: boolean = false;
    decryptToken: any = null;
    mobile_no: string = '';
    user_id: string = '';
}
