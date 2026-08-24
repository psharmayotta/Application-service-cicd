import { InferModel } from "../InferModel/InferModel.model";
import { BatchJobStatus } from "../../../config";

export class BatchInferenceJobModel extends InferModel {
    inference_id: number = 0;
    status: BatchJobStatus = BatchJobStatus.PENDING;
    result: any = null;
    configuration: any = null;
    report_path: string | null = null;
    progress: any = null;
    logs: string | null = null;
}
