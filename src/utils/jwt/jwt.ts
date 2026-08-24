import { JWT_SECRET_KEY, JWT_EXP, REFRESH_JWT_EXP } from '../../config';
import jwt from 'jsonwebtoken';

export const createjwt = (body: any) => {
    return jwt.sign({ ...body, token_type: 'access' }, JWT_SECRET_KEY, { expiresIn: JWT_EXP });
};

export const verifyjwt = (token: string) => {
    return jwt.verify(token, JWT_SECRET_KEY, { ignoreExpiration: true });
};

export const verifyjwtStrict = (token: string) => {
    return jwt.verify(token, JWT_SECRET_KEY);
};

export const refreshjwt = (body: any) => {
    return jwt.sign({ ...body, token_type: 'refresh' }, JWT_SECRET_KEY, { expiresIn: REFRESH_JWT_EXP });
};

export const isTokenValid = async (token: { exp?: number, users_id?: number, userEvent_user_type?: string }): Promise<boolean> => {
    const currentUnixTime: number = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
    if (token.exp !== undefined && typeof token.exp === 'number' && token.exp > currentUnixTime) {
        return true;
    }
    else {
        return false;
    }
};
