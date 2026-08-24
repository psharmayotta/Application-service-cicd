
import { InferModel } from "../../InferModel/InferModel.model";

export class GoogleAuthModel extends InferModel {
    token: string = '';
    email?: string;
    name?: string;
}
