import express from "express";
import { BaseController } from "../baseController.controller";
import { BatchInferenceJobService } from "../../services/batchInference/batchInferenceJob.service";
import { APP_ROUTES } from "../../core/AppRoutes";

export class BatchInferenceJobController extends BaseController {
    constructor(protected path: APP_ROUTES.BATCH_INFERENCE_JOB, public router = express.Router(), public service: BatchInferenceJobService = new BatchInferenceJobService()) {
        super(path, router, service);
    }
}
