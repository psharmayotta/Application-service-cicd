import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { RequestHandler } from 'express';
import { BadRequestResponseWithDetailMsg } from '../core/ApiResponse';
import { GenericResponse } from '../core/GenericResponse';
import { InferModel } from '../database/repository/InferModel/InferModel.model';
import { MetaModel } from '../core/MetaModel';

function validationFDMiddleware<T>(type: any, metaModel: MetaModel, skipMissingProperties = false): RequestHandler {
    return (req, res, next) => {
        const response: GenericResponse<InferModel> = new GenericResponse<InferModel>();
        const validFiles: File[] = req.files && req.files.length !== 0 ? sanitizeFile(metaModel, req.files) : null;
        validFiles !== null ? type.files = validFiles : null;
        const ptc: any = plainToInstance(type, req.body)
        ptc.files = validFiles
        validate(ptc, { skipMissingProperties }).then((errors: ValidationError[]) => {
            if (errors.length > 0) {
                let feilds = ''
                const detailMsg = errors.map((error: ValidationError) => {
                    feilds += error.property + ', '
                    const errorMessage = Object.values(error.constraints).join('. ');
                    return `${error.property}: ${errorMessage}`;
                });
                let message = `Please fill ${feilds}fields properly:\n${detailMsg.join('\n')}`;
                response.setStatus('Failed');
                response.setError(message);
                return new BadRequestResponseWithDetailMsg(message, null).send(res);
            } else {
                next();
            }
        });
    };
}

const sanitizeFile = (metaModel: MetaModel, files: any) => {
    const sanitizeFile = [];
    const keys = metaModel.files.map(file => file.fileKey);
    for (const file of metaModel.files) {
        let fileExist = null
        for (let i = 0; i < files.length; i++) {

            if (file.fileKey === files[i].fieldname) {

                fileExist = files[i]
                const data = {
                    file: files[i],
                    fileExistsValidatorOptions: {
                        allowedSize: file.allowedSize,
                        require: file.require,
                        allowedExtensions: file.allowedExtensions
                    }
                }
                console.log("inside sanatize body", data)
                sanitizeFile.push(data)
            }

        }

        if (fileExist === null) {
            const data = {
                file: undefined,
                fileExistsValidatorOptions: {
                    allowedSize: file.allowedSize,
                    allowedExtensions: file.allowedExtensions,
                    require: file.require
                }
            }

            sanitizeFile.push(data)
        }

    }
    return sanitizeFile;
}
export default validationFDMiddleware;