import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import ModelCategoryService from "../../services/modelCategory/modelCategoryService.services";

export class ModelCategoryController extends BaseController {
    constructor(protected path: APP_ROUTES.MODELCATEGORY, public router = express.Router(), public service: ModelCategoryService = new ModelCategoryService()) {
        super(path, router, service);
    }
}