import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import EmbeddingModelService from '../../services/embeddingModel/embeddingModelService.services';

export class EmbeddingModelController extends BaseController {
    constructor(
        protected path: APP_ROUTES.EMBEDDING_MODEL,
        public router = express.Router(),
        public service: EmbeddingModelService = new EmbeddingModelService()
    ) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
    }
}
