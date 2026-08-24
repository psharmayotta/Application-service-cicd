import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { StatusCode, ResponseStatus } from '../../config';
import PublicModelService from '../../services/publicModel/publicModelService.services';

export class PublicModelController extends BaseController {
    constructor(path: APP_ROUTES.PUBLIC_MODELS, public router = express.Router(), public service: PublicModelService = new PublicModelService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        // Public routes — no authMiddleware
        this.router.get(`${this.path}`, this.getPublicModels.bind(this));
        this.router.post(`${this.path}/detail`, this.getPublicModelDetail.bind(this));
    }

    /**
     * GET /public/models?category=text&search=llama&provider=Meta AI
     */
    protected async getPublicModels(req: express.Request, res: express.Response, _next: express.NextFunction) {
        try {
            const params = {
                category: req.query.category as string || undefined,
                search: req.query.search as string || undefined,
                provider: req.query.provider as string || undefined,
            };

            const data = await this.service.getPublicModels(params);
            const msg = this.handleSuccessMessage('GET', req);
            this.sendResponse(StatusCode.SUCCESS, msg, data as any, null, res, ResponseStatus.SUCCESS);
        } catch (err) {
            console.error('PublicModelController.getPublicModels error:', err);
            this.handleError(err, res);
        }
    }

    /**
     * POST /public/models/detail
     * Body: { modelId: "31" }
     */
    protected async getPublicModelDetail(req: express.Request, res: express.Response, _next: express.NextFunction) {
        try {
            const { modelId } = req.body;

            if (!modelId) {
                this.handleError('E10005', res);
                return;
            }

            const result = await this.service.getPublicModelDetail(Number(modelId));
            const msg = this.handleSuccessMessage('GET', req);
            this.sendResponse(StatusCode.SUCCESS, msg, result as any, null, res, ResponseStatus.SUCCESS);
        } catch (err) {
            console.error('PublicModelController.getPublicModelDetail error:', err);
            this.handleError(err, res);
        }
    }
}
