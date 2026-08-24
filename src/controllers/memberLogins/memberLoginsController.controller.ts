import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import MemberLoginsService from '../../services/memberLogins/memberLoginsService.services';

export class MemberLoginsController extends BaseController {
    constructor(path: APP_ROUTES.MEMBERSLOGINS, public router = express.Router(), public service: MemberLoginsService = new MemberLoginsService()) {
        super(path, router, service);
    }
}

