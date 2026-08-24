import { InferModel } from "../InferModel/InferModel.model";

export class LokiLogModel extends InferModel {
    model_id: string = '';
    model_org: string = '';
    hours_back: number = 24;
    limit: number = 1000;
    module: string = 'MYMODEL';
    start_time?: string;
    end_time?: string;
    log_level?: string;
}
