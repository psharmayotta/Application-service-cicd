import { InferModel } from "../InferModel/InferModel.model";

export class InviteModel extends InferModel {
    email: string[] = [];
    company_unique_code: string = '';
    invite_token: string = '';
    role_id: number = 0;
    decryptToken: any = null;
    status: string = 'pending';
} 