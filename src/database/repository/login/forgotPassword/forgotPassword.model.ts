import { InferModel } from "../../InferModel/InferModel.model";

export class ForgotPasswordModel extends InferModel{
    email: string = '';
    otp?: string;
    newPassword?: string;
}
