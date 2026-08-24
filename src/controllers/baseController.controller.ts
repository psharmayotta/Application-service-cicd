import express from 'express';
import { APP_ROUTES, SUCCESSMSG } from '../core/AppRoutes';
import validationFDMiddleware from '../middlewares/validationFormData.middleware';
import { Pagination, InferParams } from '../core/InferParams';
import { ENABLE_ENCRYPTION, ResponseStatus, StatusCode, NON_ENCRYPTION_ENDPOINTS } from '../config';
import sanitizeBody from '../middlewares/sanitizeBody.middleware';
import sanitizeFile from '../middlewares/sanitizeFile.middleware';
import { InferModel } from '../database/repository/InferModel/InferModel.model';
import { MetaModel } from '../core/MetaModel';
import { ErrorCodes } from '../core/ErrorCodes';
import { GenericResponse } from '../core/GenericResponse';
import { BaseServices } from '../services/baseService.services';
import { FileObject } from '../core/FileModel';
import authMiddleware from '../middlewares/authMiddleware';
import { EncryptionAndDecryption } from '../core/Encryption&Decryption';
import companyAccessMiddleware from '../middlewares/companyAccessMiddleware';

export abstract class BaseController {
    dto: any;
    constructor(protected path: APP_ROUTES, public router = express.Router(), public service: BaseServices) {
        this.dto = this.service.getDTO();
        this._initialiseRoutes();
    }

    public _initialiseRoutes(): void {
        // user
        console.log(this.path);
        // get all data
        this.router.get(`${this.path}/getall`, authMiddleware, this.getAll.bind(this));
        // get entry by id
        this.router.get(`${this.path}/getbyid/:id`, authMiddleware, this.getById.bind(this));
        // delete entry by id
        this.router.delete(`${this.path}/delete/:id`, authMiddleware, this.deleteData.bind(this));
        // create new entry
        this.router.post(`${this.path}/save`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.postData.bind(this));
        // Update entry
        this.router.post(`${this.path}/updateDeleteFlagData`, authMiddleware, this.updateDeleteFlagData.bind(this));
        // save multi entry
        this.router.post(`${this.path}/savemulti`, authMiddleware, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.postMultiData.bind(this));

        this.router.post(`${this.path}/getdata`, authMiddleware, companyAccessMiddleware, this.getData.bind(this));

        this.router.post(`${this.path}/getdatabyid`, authMiddleware, companyAccessMiddleware, this.getDataById.bind(this));
    }

    public prepareParams(param: Pagination, req: express.Request) {
        return param;
    }

    protected getAll(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const msg = this.handleSuccessMessage('GET', req);
        const param = new Pagination();
        const getParams = this.prepareParams(param, req);
        this.service
            .getAll(getParams)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

    protected setParamsForData(req: express.Request): InferParams {
        const param = new InferParams();
        param.id = +req.params.id;
        return param;
    }

    protected getById(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const params: InferParams = this.setParamsForData(req);
        const msg = this.handleSuccessMessage('GETBYID', req);
        if (this.validateData(params)) {
            this.service
                .getById(params)
                .then((data) => {
                    this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
                })
                .catch((err) => {
                    this.handleError(err, res)
                });
        } else {
            this.handleError(null, res)
        }
    }

    validateData(param: InferParams): boolean {
        if (param.id === null) {
            return false;
        }
        return true;
    }

    protected async postData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const model = this.service.getModel();
        const msg = this.handleSuccessMessage('POST', req);
        const data = this.processData(req, model);
        const validFiles: FileObject[] = req.files && req.files.length !== 0 ? this.processFileData(req, this.service.getMetaModel()) : null;
        this.service
            .createRecord(data, validFiles)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected async postMultiData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const model = this.service.getModel();
        const data = this.processData(req, model);
        const msg = this.handleSuccessMessage('POST', req);
        const validFiles: FileObject[] = req.files && req.files.length !== 0 ? this.processFileData(req, this.service.getMetaModel()) : null;
        this.service
            .createMultiRecords(data, validFiles)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                console.log('catch', err);
                this.handleError(err, res)
            });
    }

    protected deleteData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const param = new InferParams();
        const msg = this.handleSuccessMessage('DELETE', req);
        param.id = +req.params.id;
        this.service
            .deleteData(param)
            .then((response) => {
                if (response == true) {
                    this.sendResponse(StatusCode.SUCCESS, msg, null, null, res, ResponseStatus.SUCCESS);
                } else {
                    this.handleError('Error while deleting Record', res)
                }
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

    public processData(req: express.Request, InferModel: InferModel): InferModel {
        const model = sanitizeBody(InferModel, req.body);
        return model;
    }

    public processFileData(req: express.Request, metaModel: MetaModel): any {
        const validFileData = sanitizeFile(metaModel, req.files);
        return validFileData;
    }

    handleError(errorCode, res) {
        const err = this.getErrorMessage(errorCode);
        this.sendResponse(StatusCode.FAILURE, '', null, err.message, res, err.status);
    }

    getErrorMessage(errorCode: string): any {
        const error = ErrorCodes[errorCode] ? ErrorCodes[errorCode] : ErrorCodes['E10005'];
        return error;
    }

    getSuccessMsg(moduleName: string, req: express.Request): string {
        const successMsg = `${moduleName} ${SUCCESSMSG.GET}`
        return successMsg
    }

    getPostSuccessMsg(moduleName: string, req: express.Request): string {
        const data = req.body.id
        let successMsg = ''
        if (data) {
            successMsg = `${moduleName} ${SUCCESSMSG.UPDATE}`
        } else {
            successMsg = `${moduleName} ${SUCCESSMSG.ADD}`
        }
        return successMsg
    }

    getDeleteSuccessMsg(moduleName: string, req: express.Request): string {
        const successMsg = `${moduleName} ${SUCCESSMSG.DELETE}`
        return successMsg
    }

    handleSuccessMessage(method: string, req: express.Request): string {
        const moduleName = this.service.getModuleName()
        let successMsg = ''
        switch (method) {
            case 'GET':
                successMsg = this.getSuccessMsg(moduleName, req)
                break;
            case 'POST':
                successMsg = this.getPostSuccessMsg(moduleName, req)
                break;
            case 'DELETE':
                successMsg = this.getDeleteSuccessMsg(moduleName, req)
                break;
            default:
                successMsg = ''
                break;
        }
        return successMsg;
    }

    public sendResponse(status: string, msg: string, detail: InferModel, error: string, res: express.Response, statusCode: number) {
        const genericResponse: GenericResponse<InferModel> = new GenericResponse<InferModel>()
        genericResponse.setStatus(status);
        genericResponse.setMsg(msg)
        genericResponse.setError(error);
        genericResponse.setData(detail);
        const isExcluded = NON_ENCRYPTION_ENDPOINTS.includes(res.req.originalUrl) || NON_ENCRYPTION_ENDPOINTS.includes(res.req.url);
        if (ENABLE_ENCRYPTION === true && !isExcluded) {
            genericResponse.setEncryptedData(EncryptionAndDecryption.encryption(detail));
        }
        res.status(statusCode).send(genericResponse);
    }

    protected updateDeleteFlagData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        if (!req.body.id) {
            this.handleError('E10006', res);
            return;
        }
        const param = new InferParams();
        const msg = this.handleSuccessMessage('DELETE', req);
        param.id = +req.body.id;
        console.log(param, "printing the param")
        this.service
            .updateDeleteFlagData(req.body)
            .then((response) => {
                if (response == true) {
                    this.sendResponse(StatusCode.SUCCESS, msg, null, null, res, ResponseStatus.SUCCESS);
                } else {
                    this.handleError('E10001', res)
                }
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

    public prepareQueryParams(param: Pagination, req: express.Request) {
        param = req.body
        return param;
    }

    protected getData(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        const param = new Pagination()
        const msg = this.handleSuccessMessage('GET', req);
        const paramData = this.prepareQueryParams(param, req);
        this.service
            .getData(paramData)
            .then((data) => {
                // console.log(data,"-----------------controles are here")
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

    public prepareQueryParamsById(param: Pagination, req: express.Request) {
        param = req.body
        return param;
    }

    protected getDataById(req: express.Request, res: express.Response, _next: express.NextFunction) {
        console.log("------------url-----------", req.url);
        // Validate id if present in body
        if (req.body.id !== undefined) {
            const id = Number(req.body.id);
            if (isNaN(id) || !Number.isFinite(id) || !Number.isSafeInteger(id) || id === 0) {
                this.handleError('E10006', res);
                return;
            }
            if (id < 0) {
                this.handleError('E10001', res);
                return;
            }
            req.body.id = id;
        }
        const param = new Pagination()
        const msg = this.handleSuccessMessage('GETBYID', req);
        const paramData = this.prepareQueryParamsById(param, req);
        this.service
            .getDataById(paramData)
            .then((data) => {
                this.sendResponse(StatusCode.SUCCESS, msg, data, null, res, ResponseStatus.SUCCESS);
            })
            .catch((err) => {
                this.handleError(err, res)
            });
    }

}
