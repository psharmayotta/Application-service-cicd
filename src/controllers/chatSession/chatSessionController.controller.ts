import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import ChatSessionService from '../../services/chatSession/chatSessionService.services';

export class ChatSessionController extends BaseController {
    constructor(path: APP_ROUTES.CHATSESSION, public router = express.Router(), public service: ChatSessionService = new ChatSessionService()) {
        super(path, router, service);
    }
}
