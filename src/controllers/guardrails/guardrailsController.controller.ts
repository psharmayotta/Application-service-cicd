import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import GuardrailsService from "../../services/guardrails/guardrailsService.services";

export class GuardrailsController extends BaseController {
    constructor(protected path: APP_ROUTES.GUARDRAILS, public router = express.Router(), public service: GuardrailsService = new GuardrailsService()) {
        super(path, router, service);
    }
}
