import { createjwt, verifyjwt, verifyjwtStrict, refreshjwt, isTokenValid } from '../src/utils/jwt/jwt';
import jwt from 'jsonwebtoken';

describe('JWT Utility Unit Tests', () => {
    const mockPayload = { userId: 10, email: 'test@example.com' };

    test('createjwt should generate a valid JWT token string', () => {
        const token = createjwt(mockPayload);
        expect(typeof token).toBe('string');
        const decoded: any = verifyjwt(token);
        expect(decoded.userId).toBe(10);
    });

    test('verifyjwtStrict should verify non-expired token successfully', () => {
        const token = createjwt(mockPayload);
        const decoded: any = verifyjwtStrict(token);
        expect(decoded.email).toBe('test@example.com');
    });

    test('refreshjwt should generate a refresh token', () => {
        const refreshToken = refreshjwt(mockPayload);
        expect(typeof refreshToken).toBe('string');
    });

    test('isTokenValid should evaluate expiration UNIX timestamp accurately', async () => {
        const futureTime = Math.floor(Date.now() / 1000) + 3600;
        const pastTime = Math.floor(Date.now() / 1000) - 3600;

        expect(await isTokenValid({ exp: futureTime })).toBe(true);
        expect(await isTokenValid({ exp: pastTime })).toBe(false);
        expect(await isTokenValid({})).toBe(false);
    });
});
