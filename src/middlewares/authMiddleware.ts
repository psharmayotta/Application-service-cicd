import express from 'express';
import { ApiError, BadTokenError } from '../core/ApiError';
import { isTokenValid, verifyjwt } from '../utils/jwt/jwt';
import { MemberLoginsEntity } from '../entities/memberLoginsEntity';

const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            let token = req.headers.authorization.split(' ')[1];
            const decryptToken: any = verifyjwt(token);

            if (decryptToken.token_type === 'refresh') {
                return ApiError.handle(new BadTokenError('Refresh token cannot be used to access APIs'), res);
            }

            let loginUserdetail = await MemberLoginsEntity.findOneBy({
                member_id: decryptToken.member_id,
                access_token: token,
                is_delete: 0
            });


            // if (!loginUserdetail) {
            //     return ApiError.handle(new BadTokenError('Unauthorized access'), res);
            // }

            const isNotExp = await isTokenValid(decryptToken);
            if (!isNotExp) {
                return ApiError.handle(new BadTokenError('Token has expired. Please login again'), res);
            }
            req.body = { ...req.body, decryptToken };
            next();
        }
        else {
            return ApiError.handle(new BadTokenError(), res);
        }
    } catch (err) {
        return ApiError.handle(new BadTokenError(), res);
    }
};

export default authMiddleware;
