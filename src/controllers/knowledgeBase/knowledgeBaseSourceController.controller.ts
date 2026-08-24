import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import KnowledgeBaseSourceService from '../../services/knowledgeBase/knowledgeBaseSourceService.services';

export class KnowledgeBaseSourceController extends BaseController {
    constructor(
        protected path: APP_ROUTES.KNOWLEDGE_BASE_SOURCE,
        public router = express.Router(),
        public service: KnowledgeBaseSourceService = new KnowledgeBaseSourceService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
    }
}
