import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import ModelClassService from "../../services/modelClass/modelClassService.services";

export class ModelClassController extends BaseController {
    constructor(protected path: APP_ROUTES.MODELCLASS, public router = express.Router(), public service: ModelClassService = new ModelClassService()) {
        super(path, router, service);
    }
}