import { InferModel } from "../InferModel/InferModel.model";

export class NotificationModel extends InferModel {
    user_id: number = 0;
    notification_type: string = '';
    module_name: string = '';
    is_readed: boolean = false;
    company_id: number = 0;
    message: string = '';
    decryptToken: any = {};
}
