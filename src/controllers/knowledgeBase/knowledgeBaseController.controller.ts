import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import KnowledgeBaseService from '../../services/knowledgeBase/knowledgeBaseService.services';

import authMiddleware from '../../middlewares/authMiddleware';
import validationMiddleware from '../../middlewares/validationMiddleware';
import { SyncNowDto } from '../../database/repository/knowledgeBase/knowledgeBase.dto';
export class KnowledgeBaseController extends BaseController {
    constructor(protected path: APP_ROUTES.KNOWLEDGE_BASE, public router = express.Router(), public service: KnowledgeBaseService = new KnowledgeBaseService()) {
        super(path, router, service);
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post(`${this.path}/sync-now`, authMiddleware, validationMiddleware(SyncNowDto), this.syncNow.bind(this));
    }

    private async syncNow(req: any, res: express.Response) {
        try {
            const kbId = req.body.knowledge_base_id;
            const companyId = req.body.decryptToken?.company_id;

            const result = await this.service.syncNow(Number(kbId), companyId);
            res.status(200).json({ status: 200, message: 'Sync triggered successfully', data: result });
        } catch (error: any) {
            this.handleError(error, res);
        }
    }
}

