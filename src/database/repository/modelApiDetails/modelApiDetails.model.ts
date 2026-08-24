import { APILangauge } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class ModelAPIDetails extends InferModel {
    model_id: number = null;
    language: APILangauge = APILangauge.PYTHON;
    steps: Array<any> = null;
}