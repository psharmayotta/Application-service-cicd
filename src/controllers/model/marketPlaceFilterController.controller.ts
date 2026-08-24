import express from 'express';
import { APP_ROUTES } from '../../core/AppRoutes';
import MarketPlaceFilterService from '../../services/model/marketPlaceFilterService.services';
import { BaseController } from '../baseController.controller';

export class MarketPlaceFilterController extends BaseController {
    constructor(protected path: APP_ROUTES.MARKETPLACEFILTER, public router = express.Router(), public service: MarketPlaceFilterService = new MarketPlaceFilterService) {
        super(path, router, service);
    }
}
