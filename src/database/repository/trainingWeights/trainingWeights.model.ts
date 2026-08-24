import { InferModel } from "../InferModel/InferModel.model";

export class TrainingWeightsModel extends InferModel {
    training_id: number = null;
    secret_id: number = null;
    path: string = "";
    cloud_provider: number = null;
    status: string = "PENDING";
    org_id: number = null;
}
