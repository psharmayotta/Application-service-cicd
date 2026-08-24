import { InferModel } from "../../InferModel/InferModel.model";

export class SignupModel extends InferModel {
    email: string = '';
    password: string = '';
    name?: string;
}
