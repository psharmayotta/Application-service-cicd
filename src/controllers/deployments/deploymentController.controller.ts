import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import { StatusCode, ResponseStatus } from "../../config";
import validationMiddleware from "../../middlewares/validationMiddleware";
import authMiddleware from "../../middlewares/authMiddleware";
import DeploymentService from "../../services/deployments/deploymentService.services";
import { UpdateDeploymentStatusDto } from "../../database/repository/deployment/deployment.dto";

export class DeploymentController extends BaseController {
  constructor(path: APP_ROUTES.DEPLOYMENT, public router = express.Router(), public service: DeploymentService = new DeploymentService()
  ) {
    super(path, router, service);
  }

  public _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}/update-deployment-status`, authMiddleware, validationMiddleware(UpdateDeploymentStatusDto), this.updateDeploymentStatus.bind(this));
  }


  /**
   * @description update deployment status
   * @param req 
   * @param res 
   * @param _next 
   */
  protected async updateDeploymentStatus(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const msg = this.service.getModuleName();
    const data: UpdateDeploymentStatusDto = req.body;
    this.service.updateStatus(data).then((data) => {
      this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
    }).catch((err) => {
      console.log("catch updateDeploymentStatus", err);
      this.handleError(err, res);
    });
  }
}
