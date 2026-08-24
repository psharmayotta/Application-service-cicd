import { InferModel } from "../InferModel/InferModel.model";

export class LogoutModel extends InferModel {
    api_access_token: string = '';
    decryptToken: { member_id?: number ,email? : string } = {}; 
}