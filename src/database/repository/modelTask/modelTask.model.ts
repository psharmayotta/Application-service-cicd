import { InferModel } from "../InferModel/InferModel.model";

export class ModelTask extends InferModel {
    model_category_id: number = null;
    name: string = null;
    status: boolean = true;
}