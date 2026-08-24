import { InferModel } from "../InferModel/InferModel.model";

export class ChatSessionModel extends InferModel {
    member_id: number = null;
    company_id: number = null;
    api_key: string = '';
    model_id: number = null;
    session_start_time: Date = null;
    session_end_time: Date = null;
    session_duration: any = null;
    user_message: string = '';
    bot_response: string = '';
    decryptToken: any = null;
}