import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import KnowledgeBaseVectorStoreService from '../../services/knowledgeBase/knowledgeBaseVectorStoreService.services';

export class KnowledgeBaseVectorStoreController extends BaseController {
    constructor(
        protected path: any = APP_ROUTES.KNOWLEDGE_BASE_VECTOR_STORE,
        public router = express.Router(),
        public service: KnowledgeBaseVectorStoreService = new KnowledgeBaseVectorStoreService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
    }
}
