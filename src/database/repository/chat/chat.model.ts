import { InferModel } from "../InferModel/InferModel.model";

export class ChatModel extends InferModel {
    chat_session_id: number = null;
    company_id: number = null;
    user_message: string = '';
    bot_response: string = '';
}