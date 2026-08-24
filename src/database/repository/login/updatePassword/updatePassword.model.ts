import { InferModel } from "../../InferModel/InferModel.model";

export class UpdatePasswordModel extends InferModel {
    oldPassword: string = '';
    newPassword: string = '';
    confirmPassword: string = '';
    decryptToken: { member_id?: number, email?: string } = {};
}
