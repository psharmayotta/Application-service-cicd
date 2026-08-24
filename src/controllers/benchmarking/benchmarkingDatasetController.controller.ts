import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import BenchmarkingDatasetService from "../../services/benchmarking/benchmarkingDatasetService.services";
import { BaseController } from "../baseController.controller";
import authMiddleware from "../../middlewares/authMiddleware";
import { StatusCode, ResponseStatus } from "../../config";

export class BenchmarkingDatasetController extends BaseController {
    constructor(protected path: APP_ROUTES, public router = express.Router(), public service: BenchmarkingDatasetService = new BenchmarkingDatasetService()) {
        super(path, router, service);
        this._initialiseRoutesForDataset();
    }

    private _initialiseRoutesForDataset() {
        this.router.get(`${this.path}/download-sample-dataset`, authMiddleware, this.downloadSampleDataset.bind(this));
    }

    private async downloadSampleDataset(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const msg = this.handleSuccessMessage('GET', req);
        try {
            const url = await this.service.getSampleDatasetUrl();
            this.sendResponse(StatusCode.SUCCESS, msg, url as any, null as any, res, ResponseStatus.SUCCESS);
        } catch (err) {
            this.handleError(err, res);
        }
    }
}
