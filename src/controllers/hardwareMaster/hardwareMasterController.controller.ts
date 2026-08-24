import { APP_ROUTES } from "../../core/AppRoutes";
import express from 'express';
import { BaseController } from "../baseController.controller";
import HardwareMasterService from "../../services/hardwareMaster/hardwareMasterService.service";
export class HardwareMasterController extends BaseController {
    constructor(path: APP_ROUTES.HARDWAREMASTER, public router = express.Router(), public service: HardwareMasterService = new HardwareMasterService()) {
        super(path, router, service);
    }
}
