import { InferModel } from "../../InferModel/InferModel.model";

export class VerifyEmailModel extends InferModel {
    email: string = '';
    otp: string = '';
}
