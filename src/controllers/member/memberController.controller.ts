import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import MemberService from "../../services/member/memberService.services";
import { BaseController } from "../baseController.controller";
import { StatusCode, ResponseStatus } from "../../config";
import authMiddleware from "../../middlewares/authMiddleware";

export class MemberController extends BaseController {
  constructor(protected path: APP_ROUTES.MEMBERS, public router = express.Router(), public service: MemberService = new MemberService()) {
    super(path, router, service);
  }

  public _initialiseRoutes(): void {
    super._initialiseRoutes();
    this.router.post(`${this.path}/check-email`, this.checkEmail.bind(this));
    this.router.post(`${this.path}/user-detail`, authMiddleware, this.getUserDetail.bind(this));
  }

  protected async checkEmail(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const model = this.service.getModel();
    const msg = this.service.getModuleName();
    const data: any = this.processData(req, model);
    this.service
      .emailAlreadyexist(data)
      .then((data) => {
        this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        console.log('catch', err);
        this.handleError(err, res)
      });
  }

  protected async getUserDetail(req: express.Request, res: express.Response, _next: express.NextFunction) {
    const roleId = req.body.role_id;
    if (!roleId) {
      return this.handleError('E10006', res);
    }
    this.service
      .getRolePermissions(roleId)
      .then((data) => {
        this.sendResponse(StatusCode.SUCCESS, 'Role permissions fetched successfully', data, null, res, ResponseStatus.SUCCESS);
      })
      .catch((err) => {
        this.handleError(err, res);
      });
  }
}
