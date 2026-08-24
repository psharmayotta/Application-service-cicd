import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import WalletService from '../../services/wallet/walletService.services';
import { StatusCode, ResponseStatus } from '../../config';
import authMiddleware from '../../middlewares/authMiddleware';
import validationMiddleware from '../../middlewares/validationMiddleware';
import { CostForecastDto } from '../../database/repository/wallet/wallet.dto';
import { Pagination } from '../../core/InferParams';

export class WalletController extends BaseController {
    constructor(path: APP_ROUTES.WALLET, public router = express.Router(), public service: WalletService = new WalletService()) {
        super(path, router, service);
        this.initializeRoutes();
    }

    initializeRoutes() {
        this.router.post(`${this.path}/usage`, this.getUsageByModel.bind(this));
        this.router.post(
            `${this.path}/cost-forecast`,
            authMiddleware,
            validationMiddleware(CostForecastDto),
            this.getCostForecast.bind(this)
        );
    }

    override prepareQueryParamsById(param: Pagination, req: express.Request) {
        param = req.body;
        // Validate wallet_id
        const walletId = req.body.wallet_id || req.body.id;
        if (walletId !== undefined) {
            const parsed = Number(walletId);
            if (isNaN(parsed) || !Number.isFinite(parsed) || !Number.isSafeInteger(parsed) || parsed <= 0) {
                return null;
            }
            (param as any).wallet_id = parsed;
        }
        // Map id to wallet_id if only id was sent
        if (req.body.id && !req.body.wallet_id) {
            (param as any).wallet_id = Number(req.body.id);
        }
        return param;
    }

    protected getDataById(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const param = new Pagination();
        const paramData = this.prepareQueryParamsById(param, req);
        if (paramData === null) {
            this.handleError('E10006', res);
            return;
        }
        const msg = this.handleSuccessMessage('GETBYID', req);
        this.service
            .getDataById(paramData)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

    protected async getCostForecast(req: express.Request, res: express.Response, _next: express.NextFunction) {
        try {
            const data = await this.service.getCostForecast({
                company_id: Number(req.body.company_id),
                member_id: Number(req.body.decryptToken?.member_id),
                months: req.body.months == null ? undefined : Number(req.body.months),
            });

            this.sendResponse(
                StatusCode.SUCCESS,
                'Cost forecast fetched successfully.',
                data,
                null,
                res,
                ResponseStatus.SUCCESS
            );
        } catch (error) {
            this.handleError(error, res);
        }
    }

    protected async getUsageByModel(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = "Wallet Transaction Usage fetch successfully.";
        this.service
            .walletUsage(req.body)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }
}
