import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import APIKeyTokenService from '../../services/apiKeyToken/apiKeyTokenService.services';

export class APIKeyTokenController extends BaseController {
    constructor(path: APP_ROUTES.APIKEYTOKEN, public router = express.Router(), public service: APIKeyTokenService = new APIKeyTokenService()) {
        super(path, router, service);
    }
}