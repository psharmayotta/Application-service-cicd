import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import PlaygroundService from '../../services/playground/playGroundService.service';
import authMiddleware from '../../middlewares/authMiddleware';
import { StatusCode, ResponseStatus } from '../../config';

export class PlaygroundController extends BaseController {
    constructor(path: APP_ROUTES.PLAYGROUND, public router = express.Router(), public service: PlaygroundService = new PlaygroundService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        super._initialiseRoutes();
        this.router.get(`${this.path}/model-details`, this.getPlaygroundModelDetails.bind(this));
    }

    /**
     * GET /playground/model-details
     * 
     * Response:
     *   {
     *     "status": "10000",
     *     "msg": "Playground",
     *     "error": null,
     *     "details": [
     *       {
     *         "model_name": "llama3",
     *         "model_input": [...],
     *         "encrypted_model_id": "encrypted_string"
     *       }
     *     ]
     *   }
     */
    protected async getPlaygroundModelDetails(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const msg = this.service.getModuleName();
        this.service
            .getPlaygroundModelsInfo()
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data as any, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.error('getPlaygroundModelDetails error:', err);
                this.handleError(err, res);
            });
    }
}
