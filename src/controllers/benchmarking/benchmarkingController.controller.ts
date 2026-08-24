import express from "express";
import { APP_ROUTES } from "../../core/AppRoutes";
import BenchmarkingService from "../../services/benchmarking/benchmarkingService.services";
import { BaseController } from "../baseController.controller";

export class BenchmarkingController extends BaseController {
    constructor(protected path: APP_ROUTES.BENCHMARKING, public router = express.Router(), public service: BenchmarkingService = new BenchmarkingService()) {
        super(path, router, service);
    }
}
