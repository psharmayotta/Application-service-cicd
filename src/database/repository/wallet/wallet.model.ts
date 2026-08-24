import { WalletStatus } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class WalletModel extends InferModel {
    user_id: number = null;
    balance: number = 0;
    currency: string = '';
    status: WalletStatus = WalletStatus.ACTIVE;
    last_transaction_id: number = null;
}