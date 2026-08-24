import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { ResponseStatus, StatusCode } from '../../config';
import APIKeyTokenService from '../../services/apiKeyToken/apiKeyTokenService.services';
import { ValidateApiKeyDto } from '../../database/repository/validateApiKey/validateApiKey.dto';
import { ValidateApiKeyModel } from '../../database/repository/validateApiKey/validateApiKey.model';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';

export class ValidateApiKeyController extends BaseController {
    constructor(path: APP_ROUTES.VALIDATE_API_KEY, public router = express.Router(), public service: APIKeyTokenService = new APIKeyTokenService()) {
        super(path, router, service);
        this.dto = ValidateApiKeyDto;
    }

    /**
     * Override _initialiseRoutes to register ONLY the public validate endpoint.
     * No authMiddleware is applied — this is an open API.
     */
    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/validate`, validationFDMiddleware(ValidateApiKeyDto, this.service.getMetaModel()), this.validateApiKey.bind(this));
    }

    /**
     * POST /validate-api-key/validate
     * 
     * Request Body:
     *   { "api_key": "<token_string>" }
     * 
     * Response:
     *   {
     *     "status": "10000",
     *     "msg": "Playground Token",
     *     "error": null,
     *     "data": {
     *       "isValid": true
     *     }
     *   }
     */
    protected async validateApiKey(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const model = new ValidateApiKeyModel();
        const msg = this.service.getModuleName();
        const data: any = this.processData(req, model);
        this.service
            .validateApiKey(data.api_key)
            .then((isValid) => {
                this.sendResponse(StatusCode.SUCCESS, msg, { isValid } as any, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res);
            });
    }
}

