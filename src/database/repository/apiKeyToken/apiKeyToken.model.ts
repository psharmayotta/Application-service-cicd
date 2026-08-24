import { InferModel } from "../InferModel/InferModel.model";

export class APIKeyTokenModel extends InferModel {
    api_key_name: string = '';
    generated_token_time: string = '';
    expiry_token_time: string = '';
    generated_year: string = '';
    generatedby_user_id: number = null;
    company_id: number = null;
    generated_token: string = '';
    status: number = 1;
    decryptToken: { member_id?: number ,email? : string } = {}; 
}