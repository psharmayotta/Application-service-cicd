import express from "express";
import { Request, Response } from "express";
import { BaseController } from "../baseController.controller";
import { BatchInferenceService } from "../../services/batchInference/batchInference.service";
import { APP_ROUTES } from "../../core/AppRoutes";
import { StatusCode, ResponseStatus } from "../../config";
import authMiddleware from "../../middlewares/authMiddleware";

export class BatchInferenceController extends BaseController {
    constructor(protected path: APP_ROUTES, public router = express.Router(), public service: BatchInferenceService = new BatchInferenceService()) {
        super(path, router, service);
        this._initialiseRoutesForBatchInference();
    }

    private _initialiseRoutesForBatchInference() {
        this.router.get(`${this.path}/run/:id`, authMiddleware, this.runInference.bind(this));
        this.router.post(`${this.path}/run`, authMiddleware, this.runInferencePost.bind(this));
        this.router.post(`${this.path}/jobs`, authMiddleware, this.getJobs.bind(this));
        this.router.get(`${this.path}/status/:id`, authMiddleware, this.getJobStatus.bind(this));
        this.router.get(`${this.path}/results/:id`, authMiddleware, this.getResults.bind(this));
        this.router.get(`${this.path}/latest-status/:id`, authMiddleware, this.getLatestStatus.bind(this));
        this.router.get(`${this.path}/retry/:id`, authMiddleware, this.retryJob.bind(this));
        this.router.get(`${this.path}/cancel/:id`, authMiddleware, this.cancelJob.bind(this));
        this.router.post(`${this.path}/download-sample-dataset`, authMiddleware, this.downloadSampleDataset.bind(this));
    }

    private async runInference(req: Request, res: Response) {
        try {
            const service = this.service as BatchInferenceService;
            const job = await service.runInference(parseInt(req.params.id, 10));
            this.sendResponse(StatusCode.SUCCESS, "Batch inference execution started", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async runInferencePost(req: Request, res: Response) {
        try {
            const id = parseInt(req.body.id, 10);
            if (!req.body.id || isNaN(id)) {
                return this.handleError('E10006', res);
            }
            const service = this.service as BatchInferenceService;
            const job = await service.runInference(id);
            this.sendResponse(StatusCode.SUCCESS, "Batch inference execution started", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async getJobs(req: Request, res: Response) {
        try {
            const param = req.body;
            const { BatchInferenceJobService } = await import("../../services/batchInference/batchInferenceJob.service");
            const jobService = new BatchInferenceJobService();
            const data = await jobService.getData(param);
            this.sendResponse(StatusCode.SUCCESS, "Batch inference jobs fetched successfully", data as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async getJobStatus(req: Request, res: Response) {
        try {
            const service = this.service as BatchInferenceService;
            const job = await service.getJobStatus(parseInt(req.params.id, 10));
            this.sendResponse(StatusCode.SUCCESS, "Job status fetched successfully", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }


    private async getLatestStatus(req: Request, res: Response) {
        try {
            const service = this.service as BatchInferenceService;
            const job = await service.getLatestJobStatusByInferenceId(parseInt(req.params.id, 10));
            this.sendResponse(StatusCode.SUCCESS, "Latest job status fetched successfully", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async getResults(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const size = parseInt(req.query.size as string) || 10;
            const service = this.service as BatchInferenceService;
            const results = await service.getResults(parseInt(req.params.id, 10), page, size);
            this.sendResponse(StatusCode.SUCCESS, "Job results fetched successfully", results as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async retryJob(req: Request, res: Response) {
        try {
            const service = this.service as BatchInferenceService;
            const job = await service.retryJob(parseInt(req.params.id, 10));
            this.sendResponse(StatusCode.SUCCESS, "Job retried successfully", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async cancelJob(req: Request, res: Response) {
        try {
            const service = this.service as BatchInferenceService;
            const job = await service.cancelJob(parseInt(req.params.id, 10));
            this.sendResponse(StatusCode.SUCCESS, "Job cancelled successfully", job as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error.message || error, res);
        }
    }

    private async downloadSampleDataset(req: Request, res: Response) {
        try {
            const url = await this.service.getSampleDatasetUrl(req.body);
            this.sendResponse(StatusCode.SUCCESS, "Sample dataset URL fetched successfully", url as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            this.handleError(error, res);
        }
    }
}
