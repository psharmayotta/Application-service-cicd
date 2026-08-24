import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { RequestHandler } from 'express';
import { BadRequestResponseWithDetailMsg } from '../core/ApiResponse';

function validationMiddleware(type: any, skipMissingProperties = false): RequestHandler {
    return (req, res, next) => {
        const dto = plainToInstance(type, req.body);
        validate(dto, { skipMissingProperties }).then((errors: ValidationError[]) => {
            if (errors.length > 0) {
                let fields = '';
                const detailMsg = errors.map((error: ValidationError) => {
                    fields += error.property + ', ';
                    const constraints = error.constraints || {};
                    const errorMessage = Object.values(constraints).join('. ');
                    return `${error.property}: ${errorMessage}`;
                });
                const message = `Please fill ${fields}fields properly:\n${detailMsg.join('\n')}`;
                return new BadRequestResponseWithDetailMsg(message, null).send(res);
            } else {
                next();
            }
        });
    };
}

export default validationMiddleware;
