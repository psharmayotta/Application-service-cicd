import { In } from "typeorm";
import { InferModel } from "../../InferModel/InferModel.model";

export class ResetPasswordModel extends InferModel{
    email: string = '';
    otp: string = '';
    newPassword: string = '';
    reset_token: string = '';
}
