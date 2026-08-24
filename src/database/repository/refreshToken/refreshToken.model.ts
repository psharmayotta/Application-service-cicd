import { InferModel } from "../InferModel/InferModel.model";

export class RefreshTokenModel extends InferModel {
    api_refresh_token: string = '';
    decryptToken: { member_id?: number ,email? : string } = {}; 
    api_access_token: string = '';
}