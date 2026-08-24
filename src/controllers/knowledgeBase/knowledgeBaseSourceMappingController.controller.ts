import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import authMiddleware from '../../middlewares/authMiddleware';
import { Pagination } from '../../core/InferParams';
import KnowledgeBaseSourceMappingService from '../../services/knowledgeBase/knowledgeBaseSourceMappingService.services';

export class KnowledgeBaseSourceMappingController extends BaseController {
    constructor(
        protected path: APP_ROUTES.KNOWLEDGE_BASE_SOURCE_MAPPING,
        public router = express.Router(),
        public service: KnowledgeBaseSourceMappingService = new KnowledgeBaseSourceMappingService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.get(`${this.path}/getByKnowledgeBaseId/:kbId`, authMiddleware, this.getByKnowledgeBaseId.bind(this));
    }

    private async getByKnowledgeBaseId(req: express.Request, res: express.Response) {
        try {
            const kbId = parseInt(req.params.kbId);
            if (isNaN(kbId)) {
                return res.status(400).json({ error: 'Invalid knowledge base id' });
            }
            const param: Pagination = new Pagination();
            (param as any).knowledge_base_id = kbId;
            param.pageSize = 1000; // large number to get all
            param.pageNumber = 1;
            const result = await this.service.getData(param);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
