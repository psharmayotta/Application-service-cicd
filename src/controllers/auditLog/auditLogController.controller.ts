import express from 'express';
import AuditLogService from '../../services/auditLog/auditLogService.services';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { ResponseStatus, StatusCode } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';

export class AuditLogController extends BaseController {
    constructor(path: APP_ROUTES.AUDIT_LOG, public router = express.Router(), public service: AuditLogService = new AuditLogService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.get(`${this.path}/test_members`, async (req, res) => {
            const data = await this.service.getAuditLogMembers({ company_id: 1 });
            res.json({ success: true, data });
        });
        this.router.post(`${this.path}/members`, authMiddleware, this.getAuditLogMembers.bind(this));
        this.router.post(`${this.path}/modules`, authMiddleware, this.getAuditLogModules.bind(this));
        this.router.post(`${this.path}/actions`, authMiddleware, this.getAuditLogActions.bind(this));
    }

    protected async getAuditLogMembers(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = 'Audit Log Members';
        this.service
            .getAuditLogMembers(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }

    protected async getAuditLogModules(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = 'Audit Log Modules';
        this.service
            .getAuditLogModules(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }

    protected async getAuditLogActions(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = 'Audit Log Actions';
        this.service
            .getAuditLogActions(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }
}
