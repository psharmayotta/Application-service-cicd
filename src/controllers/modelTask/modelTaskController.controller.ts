import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import ModelTaskService from "../../services/modelTask/modelTaskService.services";

export class ModelTaskController extends BaseController {
    constructor(protected path: APP_ROUTES.MODELTASK, public router = express.Router(), public service: ModelTaskService = new ModelTaskService()) {
        super(path, router, service);
    }
}