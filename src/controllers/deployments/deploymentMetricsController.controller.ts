import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import { StatusCode, ResponseStatus } from "../../config";
import validationMiddleware from "../../middlewares/validationMiddleware";
import { DeploymentMetricsService } from "../../services/deployments/deploymentMetricsService.service";
import { DeploymentMetricsDto } from "../../database/repository/deployment/deploymentMetrics.dto";

export class DeploymentMetricsController extends BaseController {
    constructor(path: APP_ROUTES.DEPLOYMENT, public router = express.Router(), public service: DeploymentMetricsService = new DeploymentMetricsService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/metrics`, validationMiddleware(DeploymentMetricsDto), this.getDeploymentMetrics.bind(this));
    }

    /**
     * @description get deployment metrics from Loki
     * @param req 
     * @param res 
     * @param _next 
     */
    protected async getDeploymentMetrics(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = "Deployment Metrics";
        const query: DeploymentMetricsDto = req.body;

        this.service.getDeploymentMetrics(query).then((data) => {
            this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
        }).catch((err) => {
            console.log("catch getDeploymentMetrics", err);
            this.handleError(err, res);
        });
    }
}
