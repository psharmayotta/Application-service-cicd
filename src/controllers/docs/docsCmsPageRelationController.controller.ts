import express from 'express';
import { APP_ROUTES } from '../../core/AppRoutes';
import { BaseController } from '../baseController.controller';
import DocsCmsPageRelationServices from '../../services/docs/docsCmsPageRelationServices';

export class DocsCmsPageRelationController extends BaseController {
    constructor(protected path: APP_ROUTES.DOCSCMSPAGERELATION, public router = express.Router(), public service: DocsCmsPageRelationServices = new DocsCmsPageRelationServices) {
        super(path, router, service);
    }
}
