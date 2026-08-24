import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import EvaluationTaskService from "../../services/benchmarking/evaluationTaskService.services";
import { BaseController } from "../baseController.controller";
import authMiddleware from "../../middlewares/authMiddleware";
import { ResponseStatus } from "../../config";

export class EvaluationTaskController extends BaseController {
    constructor(protected path: APP_ROUTES.EVALUATION_TASKS, public router = express.Router(), public service: EvaluationTaskService = new EvaluationTaskService()) {
        super(path, router, service);
    }
}
