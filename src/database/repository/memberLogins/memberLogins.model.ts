import { InferModel } from "../InferModel/InferModel.model";

export class MemberLoginsModel extends InferModel {
    member_id: number = 0;
    provider: string = '';
    provider_user_id: string = '';
    access_token: string = '';
    refresh_token: string = '';
    token_expiry: Date = null;
    password: string = '';
} 