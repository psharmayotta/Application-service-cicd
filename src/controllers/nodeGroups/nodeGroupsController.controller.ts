import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import NodeGroupsService from '../../services/nodeGroup/nodeGroupService.service';

export class NodeGroupsController extends BaseController {
    constructor(protected path: APP_ROUTES.NODEGROUPS, public router = express.Router(), public service: NodeGroupsService = new NodeGroupsService()) {
        super(path, router, service);
    } 
}
