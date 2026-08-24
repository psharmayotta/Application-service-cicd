import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import TrainingWeightsService from "../../services/modelTraining/trainingWeightsService.services";
import { BaseController } from "../baseController.controller";

export class TrainingWeightsController extends BaseController {
    constructor(protected path: APP_ROUTES.TRAINING_WEIGHTS, public router = express.Router(), public service: TrainingWeightsService = new TrainingWeightsService()) {
        super(path, router, service);
    }
}