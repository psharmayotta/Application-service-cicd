import authMiddleware from '../src/middlewares/authMiddleware';
import * as jwtUtils from '../src/utils/jwt/jwt';
import { MemberLoginsEntity } from '../src/entities/memberLoginsEntity';
import { ApiError } from '../src/core/ApiError';

describe('Auth Middleware Unit Tests', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        mockReq = {
            headers: {},
            body: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    test('should return BadTokenError if Authorization header is missing', async () => {
        const errorSpy = jest.spyOn(ApiError, 'handle').mockReturnValue(mockRes as any);

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(errorSpy).toHaveBeenCalled();
        expect(mockNext).not.toHaveBeenCalled();
    });

    test('should pass request to next() if token is valid', async () => {
        mockReq.headers.authorization = 'Bearer valid-jwt-token';

        const mockDecrypted = { member_id: 101, exp: Math.floor(Date.now() / 1000) + 3600 };
        jest.spyOn(jwtUtils, 'verifyjwt').mockReturnValue(mockDecrypted as any);
        jest.spyOn(MemberLoginsEntity, 'findOneBy').mockResolvedValue({ id: 1 } as any);
        jest.spyOn(jwtUtils, 'isTokenValid').mockResolvedValue(true);

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(mockReq.body.decryptToken).toEqual(mockDecrypted);
        expect(mockNext).toHaveBeenCalled();
    });

    test('should return error if token is expired', async () => {
        mockReq.headers.authorization = 'Bearer expired-jwt-token';

        jest.spyOn(jwtUtils, 'verifyjwt').mockReturnValue({ member_id: 101 } as any);
        jest.spyOn(MemberLoginsEntity, 'findOneBy').mockResolvedValue({ id: 1 } as any);
        jest.spyOn(jwtUtils, 'isTokenValid').mockResolvedValue(false);
        const errorSpy = jest.spyOn(ApiError, 'handle').mockReturnValue(mockRes as any);

        await authMiddleware(mockReq, mockRes, mockNext);

        expect(errorSpy).toHaveBeenCalled();
        expect(mockNext).not.toHaveBeenCalled();
    });
});
