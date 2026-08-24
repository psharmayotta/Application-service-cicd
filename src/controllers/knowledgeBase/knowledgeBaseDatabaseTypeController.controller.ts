import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import KnowledgeBaseDatabaseTypeService from '../../services/knowledgeBase/knowledgeBaseDatabaseTypeService.services';

export class KnowledgeBaseDatabaseTypeController extends BaseController {
    constructor(
        protected path: APP_ROUTES.DATABASE_TYPE,
        public router = express.Router(),
        public service: KnowledgeBaseDatabaseTypeService = new KnowledgeBaseDatabaseTypeService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
    }
}
