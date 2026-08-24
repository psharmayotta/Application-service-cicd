import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import ModelTrainingListingService from "../../services/modelTraining/modelTrainingListingService.services";
import { BaseController } from "../baseController.controller";

export class ModelTrainingListingController extends BaseController {
    constructor(protected path: APP_ROUTES.MODELTRAININGLISTING, public router = express.Router(), public service: ModelTrainingListingService = new ModelTrainingListingService()) {
        super(path, router, service);
    }
}