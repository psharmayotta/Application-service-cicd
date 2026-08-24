import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { KnowledgeBaseJobService } from '../../services/knowledgeBase/knowledgeBaseJobService.services';

export class KnowledgeBaseJobController extends BaseController {
    constructor(path: APP_ROUTES.KNOWLEDGE_BASE_JOB, public router = express.Router(), public service: KnowledgeBaseJobService = new KnowledgeBaseJobService()) {
        super(path, router, service);
    }
}
