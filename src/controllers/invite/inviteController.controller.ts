import express from 'express';
import { InviteDto } from '../../database/repository/invite/invite.dto';
import InviteService from '../../services/invite/inviteService.services';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import { ResponseStatus, StatusCode } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';

export class InviteController extends BaseController {
    constructor(path: APP_ROUTES.INVITE, public router = express.Router(), public service: InviteService = new InviteService()) {
        super(path, router, service);
    }


    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/validate`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.validateInviteCode.bind(this));
        this.router.post(`${this.path}/resend-invite`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.resendInvite.bind(this));
        this.router.post(`${this.path}/copy-invite-link`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.getInviteLink.bind(this));
        this.router.post(`${this.path}/cancel-invite`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.cancelInvite.bind(this));
        this.router.post(`${this.path}/multi-workspace-invite`, authMiddleware, this.multiWorkspaceInvite.bind(this));
        this.router.post(`${this.path}/details`, this.getInviteDetails.bind(this));
        this.router.post(`${this.path}/respond`, this.respondToInvite.bind(this));
    }

    protected async validateInviteCode(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .validateInviteCode(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async resendInvite(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .resendInvite(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async getInviteLink(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .getInviteLink(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async cancelInvite(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .cancelInvite(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async getInviteDetails(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = this.service.getModuleName();
        this.service
            .getInviteDetails(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res);
            });
    }

    protected async respondToInvite(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = this.service.getModuleName();
        this.service
            .respondToInvite(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res);
            });
    }

    protected async multiWorkspaceInvite(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const { email, role_id, workspace_ids, firstName, lastName, mobileNo } = req.body;

        if (!email || !workspace_ids || !Array.isArray(workspace_ids) || workspace_ids.length === 0) {
            this.handleError("E10005", res);
            return;
        }

        const authToken = req.headers.authorization?.replace('Bearer ', '') || '';

        this.service
            .multiWorkspaceInvite({
                email: Array.isArray(email) ? email : [email],
                role_id: role_id || 2,
                workspace_ids,
                firstName,
                lastName,
                mobileNo,
                decryptToken: (req.body as any).decryptToken,
                authToken,
            })
            .then((result) => {
                this.sendResponse(StatusCode.SUCCESS, "Invites processed successfully", result, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res);
            });
    }
}
