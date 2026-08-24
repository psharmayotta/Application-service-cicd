import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import WebhookPlatformService from '../../services/webhookConfig/webhookPlatformService.services';

export class WebhookPlatformController extends BaseController {
  constructor(path: APP_ROUTES, public router = express.Router(), public service: WebhookPlatformService = new WebhookPlatformService()) {
    super(path, router, service);
  }
}

export default WebhookPlatformController;
