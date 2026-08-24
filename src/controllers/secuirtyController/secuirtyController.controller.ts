import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { EncryptionAndDecryption } from '../../core/Encryption&Decryption';
import { ResponseStatus, StatusCode } from '../../config';
import SecurityService from '../../services/securityService/securityService.services';

export class SecuirtyController extends BaseController {
    constructor(path: APP_ROUTES.SECURITY, public router = express.Router(), public service: SecurityService = new SecurityService()) {
        super(path, router, service);
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/encryption`, this.encryptData.bind(this));
        this.router.post(`${this.path}/decryption`, this.decryptData.bind(this));
    }

    public encryptData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        const encryptedData = EncryptionAndDecryption.encryption(req.body);
        this.sendResponse(StatusCode.SUCCESS, `Data encrypted successfully`, encryptedData, null, res, ResponseStatus.SUCCESS);
    };

    public decryptData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        if (!req.body.details) {
            this.sendResponse(StatusCode.FAILURE, 'Invalid request', null, 'details field is required', res, ResponseStatus.BAD_REQUEST);
            return;
        }
        const decryptedData = EncryptionAndDecryption.decryption(req.body.details);
        if (decryptedData === StatusCode.INVALID_ENCRYPTED_INPUT) {
            this.sendResponse(StatusCode.FAILURE, 'Decryption failed', null, 'Invalid encrypted input', res, ResponseStatus.BAD_REQUEST);
            return;
        }
        this.sendResponse(StatusCode.SUCCESS, `Data decrypted successfully`, decryptedData, null, res, ResponseStatus.SUCCESS);
    };

}