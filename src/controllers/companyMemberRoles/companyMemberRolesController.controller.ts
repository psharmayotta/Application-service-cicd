import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import CompanyMemberRolesService from '../../services/companyMemberRoles/companyMemberRolesService.services';
import { StatusCode, ResponseStatus } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';

export class CompanyMemberRolesController extends BaseController {
    constructor(path: APP_ROUTES.COMPANY_MEMBER_ROLES, public router = express.Router(), public service: CompanyMemberRolesService = new CompanyMemberRolesService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.post(`${this.path}/approve`, this.approve.bind(this));
        this.router.post(`${this.path}/reject`, this.reject.bind(this));
        this.router.post(`${this.path}/de-activate`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.deActivate.bind(this));
    }

    protected async deActivate(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = this.service.getModel();
        const msg = "Deactivated successfully";
        const data: any = this.processData(req, model);
        this.service
            .deActivate(data)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async approve(req: express.Request, res: express.Response): Promise<void> {
        try {
            const { admin_id, member_id, company_id } = req.body;

            if (!admin_id || !member_id || !company_id) {
                this.sendResponse(StatusCode.FAILURE, 'Missing required fields', null, 'adminMemberId, member_id and company_id are required', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            await this.service.approveMember(admin_id, member_id, company_id);
            this.sendResponse(StatusCode.SUCCESS, 'Member approved successfully', null, null, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            console.error('Approve member error:', error);
            const status = error === 'E10056' ? ResponseStatus.FORBIDDEN : (error === 'E10055' ? ResponseStatus.BAD_REQUEST : ResponseStatus.INTERNAL_ERROR);
            const message = error === 'E10056' ? 'Unauthorized' : (error === 'E10055' ? 'Already Approved or Rejected' : 'Internal server error');
            this.sendResponse(StatusCode.FAILURE, message, null, error.message || error, res, status);
        }
    }

    protected async reject(req: express.Request, res: express.Response): Promise<void> {
        try {
            const { admin_id, member_id, company_id } = req.body;

            if (!admin_id || !member_id || !company_id) {
                this.sendResponse(StatusCode.FAILURE, 'Missing required fields', null, 'adminMemberId, member_id and company_id are required', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            await this.service.rejectMember(admin_id, member_id, company_id);
            this.sendResponse(StatusCode.SUCCESS, 'Member rejected successfully', null, null, res, ResponseStatus.SUCCESS);
        } catch (error: any) {
            console.error('Reject member error:', error);
            const status = error === 'E10056' ? ResponseStatus.FORBIDDEN : (error === 'E10055' ? ResponseStatus.BAD_REQUEST : ResponseStatus.INTERNAL_ERROR);
            const message = error === 'E10056' ? 'Unauthorized' : (error === 'E10055' ? 'Already Approved or Rejected' : 'Internal server error');
            this.sendResponse(StatusCode.FAILURE, message, null, error.message || error, res, status);
        }
    }
}
