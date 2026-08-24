import axios from 'axios';
import { createjwt } from '../jwt/jwt';
import { CLIENTID, CLIENTSECRET } from '../../config';

export interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export interface GoogleTokenInfo {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
}

export class GoogleOAuth {
    private static readonly GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/auth';
    private static readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private static readonly GOOGLE_USER_INFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

    /**
     * Validate OAuth configuration
     */
    static validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!CLIENTID || CLIENTID.trim() === '') {
            errors.push('Google Client ID is not configured');
        }

        if (!CLIENTSECRET || CLIENTSECRET.trim() === '') {
            errors.push('Google Client Secret is not configured');
        }

        // Validate Client ID format (should end with .apps.googleusercontent.com)
        if (CLIENTID && !CLIENTID.endsWith('.apps.googleusercontent.com')) {
            errors.push('Invalid Google Client ID format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate Google OAuth URL for authorization
     */
    static getAuthUrl(redirectUri: string, state?: string): string {
        const params = new URLSearchParams({
            client_id: CLIENTID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'email profile',
            access_type: 'offline',
            prompt: 'consent'
        });

        if (state) {
            params.append('state', state);
        }

        return `${this.GOOGLE_OAUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    static async getAccessToken(code: string, redirectUri: string): Promise<GoogleTokenInfo> {
        try {
            // Validate inputs
            if (!code || typeof code !== 'string') {
                throw new Error('Invalid authorization code provided');
            }

            if (!redirectUri || typeof redirectUri !== 'string') {
                throw new Error('Invalid redirect URI provided');
            }

            // Ensure redirect URI is properly formatted
            try {
                new URL(redirectUri);
            } catch (urlError) {
                throw new Error(`Invalid redirect URI format: ${redirectUri}`);
            }

            console.log('Getting access token with:', {
                client_id: CLIENTID,
                redirect_uri: redirectUri,
                code_length: code?.length || 0
            });

            // Use URLSearchParams to properly format the data as form-encoded
            const formData = new URLSearchParams({
                client_id: CLIENTID,
                client_secret: CLIENTSECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri
            });

            console.log('Form data being sent:', formData.toString());

            const response = await axios.post(this.GOOGLE_TOKEN_URL, formData.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            console.log('Token response received:', {
                status: response.status,
                has_access_token: !!response.data.access_token,
                expires_in: response.data.expires_in
            });

            return response.data;
        } catch (error: any) {
            console.error('Error getting Google access token:', error);
            
            // Log more detailed error information
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
                console.error('Response headers:', error.response.headers);
            }
            
            throw new Error(`Failed to get Google access token: ${error.message}`);
        }
    }

    /**
     * Get user information from Google using access token
     */
    static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
        try {
            const response = await axios.get(this.GOOGLE_USER_INFO_URL, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error: any) {
            console.error('Error getting Google user info:', error);
            
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            
            throw new Error(`Failed to get Google user information: ${error.message}`);
        }
    }

    /**
     * Complete OAuth flow and return user data
     */
    static async completeOAuthFlow(code: string, redirectUri: string): Promise<GoogleUserInfo> {
        try {
            const tokenInfo = await this.getAccessToken(code, redirectUri);
            const userInfo = await this.getUserInfo(tokenInfo.access_token);
            return userInfo;
        } catch (error: any) {
            console.error('Error in OAuth flow:', error);
            throw error;
        }
    }

    /**
     * Generate JWT token for Google OAuth user
     */
    static generateJWT(userInfo: GoogleUserInfo, memberId: number, companyId: number = 1, roleId: number = 1): string {
        return createjwt({
            member_id: memberId,
            email: userInfo.email,
            company_id: companyId,
            role_id: roleId,
            oauth_provider: 'google',
            oauth_id: userInfo.id
        });
    }
}
