import express from 'express';
import { APP_ROUTES } from '../../core/AppRoutes';
import ContactUsService from '../../services/contactUs/contactUsService.services';
import { BaseController } from '../baseController.controller';

export class ContactUsController extends BaseController {
    constructor(path: APP_ROUTES.CONTACTUS, public router = express.Router(), public service: ContactUsService = new ContactUsService()) {
        super(path, router, service);
    }
}