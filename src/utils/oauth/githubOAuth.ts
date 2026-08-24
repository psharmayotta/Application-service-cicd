import axios from 'axios';
import { createjwt } from '../jwt/jwt';
import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '../../config';

export interface GithubUserInfo {
    id: number;
    login: string;
    email: string;
    name: string;
    avatar_url: string;
}

export interface GithubTokenInfo {
    access_token: string;
    token_type: string;
    scope: string;
}

export class GithubOAuth {
    private static readonly GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
    private static readonly GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    private static readonly GITHUB_USER_INFO_URL = 'https://api.github.com/user';
    private static readonly GITHUB_USER_EMAILS_URL = 'https://api.github.com/user/emails';

    /**
     * Validate OAuth configuration
     */
    static validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID.trim() === '') {
            errors.push('GitHub Client ID is not configured');
        }

        if (!GITHUB_CLIENT_SECRET || GITHUB_CLIENT_SECRET.trim() === '') {
            errors.push('GitHub Client Secret is not configured');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate GitHub OAuth URL for authorization
     */
    static getAuthUrl(redirectUri: string, state?: string): string {
        const params = new URLSearchParams({
            client_id: GITHUB_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'user:email read:user',
            state: state || ''
        });

        return `${this.GITHUB_OAUTH_URL}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    static async getAccessToken(code: string, redirectUri: string): Promise<GithubTokenInfo> {
        try {
            const response = await axios.post(this.GITHUB_TOKEN_URL, {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri
            }, {
                headers: {
                    Accept: 'application/json'
                }
            });

            if (response.data.error) {
                throw new Error(response.data.error_description || response.data.error);
            }

            return response.data;
        } catch (error: any) {
            console.error('Error getting GitHub access token:', error);
            throw new Error(`Failed to get GitHub access token: ${error.message}`);
        }
    }

    /**
     * Get user information from GitHub using access token
     */
    static async getUserInfo(accessToken: string): Promise<GithubUserInfo> {
        try {
            const response = await axios.get(this.GITHUB_USER_INFO_URL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const userInfo = response.data;

            // If email is not public, fetch it separately
            if (!userInfo.email) {
                const emailsResponse = await axios.get(this.GITHUB_USER_EMAILS_URL, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });

                const primaryEmail = emailsResponse.data.find((email: any) => email.primary && email.verified);
                if (primaryEmail) {
                    userInfo.email = primaryEmail.email;
                }
            }

            return userInfo;
        } catch (error: any) {
            console.error('Error getting GitHub user info:', error);
            throw new Error(`Failed to get GitHub user information: ${error.message}`);
        }
    }

    /**
     * Complete OAuth flow and return user data
     */
    static async completeOAuthFlow(code: string, redirectUri: string): Promise<GithubUserInfo> {
        try {
            const tokenInfo = await this.getAccessToken(code, redirectUri);
            const userInfo = await this.getUserInfo(tokenInfo.access_token);
            return userInfo;
        } catch (error: any) {
            console.error('Error in GitHub OAuth flow:', error);
            throw error;
        }
    }
}
