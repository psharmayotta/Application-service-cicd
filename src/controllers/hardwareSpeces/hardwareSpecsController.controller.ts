import express from "express";
import { BaseController } from "../baseController.controller";
import { APP_ROUTES } from "../../core/AppRoutes";
import HardwareSpecsService from "../../services/hardwareSpecs/hardwareSpecsService.services";


export class HardwareSpecsController extends BaseController {
    constructor(protected path: APP_ROUTES.HARDWARESPECS, public router = express.Router(), public service: HardwareSpecsService = new HardwareSpecsService()) {
        super(path, router, service);
    }
}