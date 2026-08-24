import express from 'express';
import { BaseController } from '../baseController.controller';
import { APP_ROUTES } from '../../core/AppRoutes';
import { EmailService } from '../../utils/email/emailService';
import { EmailTemplates } from '../../utils/email/emailTemplates';
import { createjwt, refreshjwt } from '../../utils/jwt/jwt';
import { GoogleOAuth, GoogleUserInfo } from '../../utils/oauth/googleOAuth';
import { GithubOAuth, GithubUserInfo } from '../../utils/oauth/githubOAuth';
import { MemberLoginsEntity } from '../../entities/memberLoginsEntity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { StatusCode, ResponseStatus, DEV_URL, FRONTENDURL, LOCALURL, ENABLE_ENCRYPTION, FRONTENDDOMAIN, KAFKAPRODUCERS, ModuleType, MEMBERAPPROVALREQUESTURL } from '../../config';
import validationFDMiddleware from '../../middlewares/validationFormData.middleware';
import { SsoLoginDto } from '../../database/repository/userManagement/ssoLogin.dto';
import MemberService from '../../services/member/memberService.services';
import CompanyService from '../../services/company/companyService.services';
import { GenericResponse } from '../../core/GenericResponse';
import { InferModel } from '../../database/repository/InferModel/InferModel.model';
import { EncryptionAndDecryption } from '../../core/Encryption&Decryption';
import APIKeyTokenService from '../../services/apiKeyToken/apiKeyTokenService.services';
import { KafkaService } from '../../utils/kafka/KafkaService';
import CompanyMemberRolesService from '../../services/companyMemberRoles/companyMemberRolesService.services';

export class LoginController extends BaseController {
    private companyService: CompanyService;
    private companyMemberRolesService: CompanyMemberRolesService;

    constructor(protected path: APP_ROUTES.LOGIN, public router = express.Router(), public service: MemberService = new MemberService()) {
        super(path, router, service);
        this.companyService = new CompanyService();
        this.companyMemberRolesService = new CompanyMemberRolesService();
    }

    public _initialiseRoutes(): void {
        this.router.post(`${this.path}/signup`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.signup.bind(this));

        this.router.get(`${this.path}/verify-email/:token`, this.verifyEmail.bind(this));

        this.router.post(`${this.path}/login`, validationFDMiddleware(this.dto, this.service.getMetaModel()), this.login.bind(this));

        this.router.post(`${this.path}/resend-verification`, this.resendVerification.bind(this));

        this.router.post(`${this.path}/forgot-password`, this.forgotPassword.bind(this));
        this.router.post(`${this.path}/reset-password`, this.resetPassword.bind(this));
        this.router.post(`${this.path}/forgot-password-link-verify`, this.forgotPasswordLinkVerify.bind(this));

        // SSO login endpoint
        this.router.post(`${this.path}/sso`, validationFDMiddleware(SsoLoginDto, this.service.getMetaModel()), this.ssoLogin.bind(this));

        // Google OAuth endpoints
        this.router.get(`${this.path}/google/auth`, this.googleAuth.bind(this));
        this.router.get(`${this.path}/google/callback`, this.googleCallback.bind(this));

        // GitHub OAuth endpoints
        this.router.get(`${this.path}/github/auth`, this.githubAuth.bind(this));
        this.router.get(`${this.path}/github/callback`, this.githubCallback.bind(this));
    }

    protected async signup(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { email, password, full_name, mobile_no, profile_picture, company_name, is_individual, company_unique_id } = req.body;
            const existingMember = await this.service.findByEmail(email);
            if (existingMember) {
                if (existingMember.email_verification_pending) {
                    this.sendResponse(StatusCode.FAILURE, 'Email verification pending', null, 'Please verify your email', res, ResponseStatus.BAD_REQUEST);
                    return;
                }
                if (full_name || mobile_no || profile_picture || company_name || is_individual || company_unique_id) {
                    const updateData: any = {
                        profile_complete: true
                    };
                    if (full_name) updateData.full_name = full_name;
                    if (mobile_no) updateData.mobile_no = mobile_no;
                    if (profile_picture) updateData.profile_picture = profile_picture;
                    await this.service.updateMember(existingMember.id, updateData);

                    const roleId = 1;
                    let createdCompany;

                    if (company_unique_id) {
                        const existingCompany = await this.companyService.findByCompanyUniqueId(company_unique_id);
                        if (!existingCompany) {
                            this.sendResponse(StatusCode.FAILURE, 'Invalid Company Unique ID', null, 'Company not found', res, ResponseStatus.BAD_REQUEST);
                            return;
                        }

                        // Check if already a member
                        const existingRole = await this.service.getCompaniesForMember(existingMember.id);
                        const isMember = existingRole.some((c: any) => c.id === existingCompany.id);

                        if (!isMember) {
                            await this.service.assignMemberRole({
                                company_id: existingCompany.id,
                                member_id: existingMember.id,
                                role_id: 2, // Assuming role 2 is Member
                                default_company: true,
                                active: false // Pending approval
                            });

                            // Notify Admins
                            const admins = await this.companyMemberRolesService.getCompanyAdmins(existingCompany.id);
                            for (const admin of admins) {
                                const request = {
                                    to: admin.email,
                                    emailcode: 'MEMBER_APPROVAL_REQUEST', // Assuming this code exists or using a generic one
                                    variables: {
                                        ADMIN_NAME: admin.full_name,
                                        USER_NAME: existingMember.full_name || full_name,
                                        USER_EMAIL: existingMember.email || email,
                                        COMPANY_NAME: existingCompany.company_name,
                                        VERIFICATION_LINK: `${MEMBERAPPROVALREQUESTURL}${EncryptionAndDecryption.encryption({
                                            email: existingMember.email || email,
                                            member_id: existingMember.id,
                                            company_id: existingCompany.id,
                                            user_name: existingMember.full_name || full_name,
                                            company_name: existingCompany.company_name,
                                            admin_name: admin.full_name,
                                            admin_id: admin.id
                                        })}`
                                    }
                                };
                                const kafkaMessage = {
                                    module: ModuleType.EMAIL,
                                    request
                                }
                                const kafkaService = KafkaService.getInstance();
                                await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
                            }

                            this.sendResponse(StatusCode.SUCCESS, 'Request sent to company admin for approval', null, null, res, ResponseStatus.SUCCESS);
                            return;
                        }

                        createdCompany = existingCompany;
                    } else {
                        let nameToUse = company_name;

                        if (is_individual) {
                            const emailPrefix = email.split('@')[0];
                            const randomSuffix = Math.random().toString(36).substring(2, 6);
                            nameToUse = `${emailPrefix}-${randomSuffix}`;
                        }
                        try {
                            createdCompany = await this.companyService.createCompany({
                                company_name: nameToUse,
                                industry: 'Technology',
                                company_email: email.split('@')[1],
                                is_active: true
                            }, { member_id: existingMember.id, role_id: roleId, default_company: true, active: true });
                        } catch (err: any) {
                            this.sendResponse(StatusCode.FAILURE, 'A company with this name already exists', null, 'A company with this name already exists', res, ResponseStatus.BAD_REQUEST);
                            return;
                        }
                        (createdCompany as any).company_name = nameToUse;
                    }


                    await this.service.assignMemberRole({ company_id: createdCompany.id, member_id: existingMember.id, role_id: roleId, default_company: true, active: true });
                    const updatedMember = await this.service.findById(existingMember.id);
                    const tokenExpires = new Date();
                    tokenExpires.setHours(tokenExpires.getHours() + 24);
                    const token = createjwt({
                        email: updatedMember.email,
                        member_id: updatedMember.id,
                        role_id: 1
                    });
                    const refresh_token = refreshjwt({
                        email: updatedMember.email,
                        member_id: updatedMember.id,
                        role_id: 1
                    });
                    await this.service.createOrUpdateLogin(updatedMember.id, {
                        provider: 'email_verification',
                        access_token: token,
                        refresh_token: refresh_token,
                        token_expiry: tokenExpires
                    });
                    (updatedMember as any).token = token;
                    (updatedMember as any).refresh_token = refresh_token;
                    const companies = await this.service.getCompaniesForMember(updatedMember.id);
                    const apiKeyTokenService = new APIKeyTokenService();
                    const apiKey = await apiKeyTokenService.createInitialApiKeyToken(updatedMember.id);
                    (updatedMember as any).companies = companies;
                    (updatedMember as any).apiKey = apiKey;
                    this.sendResponse(StatusCode.SUCCESS, 'Profile completed successfully', updatedMember, null, res, ResponseStatus.SUCCESS);
                    return;
                }

                this.sendResponse(StatusCode.FAILURE, 'Email already registered', null, 'Email already exists', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // New member registration - only email and password required
            if (!password) {
                this.sendResponse(StatusCode.FAILURE, 'Password is required for new registration', null, 'Password field is missing', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const memberData = {
                email,
                full_name: full_name || null,
                mobile_no: mobile_no || null,
                profile_picture: profile_picture || null,
                email_verification_pending: true,
                is_active: true
            };

            const newMember = await this.service.createMember(memberData);
            await this.service.createPasswordLogin(newMember.id, hashedPassword);

            if (company_unique_id) {
                const existingCompany = await this.companyService.findByCompanyUniqueId(company_unique_id);
                if (existingCompany) {
                    await this.service.assignMemberRole({
                        company_id: existingCompany.id,
                        member_id: newMember.id,
                        role_id: 2, // Member role
                        default_company: true,
                        active: false // Pending approval
                    });

                    // Notify Admins
                    const admins = await this.companyMemberRolesService.getCompanyAdmins(existingCompany.id);
                    for (const admin of admins) {
                        const request = {
                            to: admin.email,
                            emailcode: 'MEMBER_APPROVAL_REQUEST',
                            variables: {
                                ADMIN_NAME: admin.full_name,
                                USER_NAME: newMember.full_name,
                                USER_EMAIL: newMember.email,
                                COMPANY_NAME: existingCompany.company_name,
                                VERIFICATION_LINK: `${MEMBERAPPROVALREQUESTURL}${EncryptionAndDecryption.encryption({
                                    email: newMember.email,
                                    member_id: newMember.id,
                                    company_id: existingCompany.id,
                                    user_name: full_name || email
                                })}`
                            }
                        };
                        const kafkaMessage = {
                            module: ModuleType.EMAIL,
                            request
                        }
                        const kafkaService = KafkaService.getInstance();
                        await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
                    }
                }
            }

            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = new Date();
            tokenExpires.setHours(tokenExpires.getHours() + 24);

            await this.service.createOrUpdateLogin(newMember.id, {
                provider: 'email_verification',
                access_token: verificationToken,
                token_expiry: tokenExpires
            });

            const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
            // const emailHtml = EmailTemplates.getEmailVerificationTemplate(email, verificationUrl, full_name || "");
            const request = {
                to: email,
                emailcode: 'VERIFY_EMAIL',
                variables: {
                    VERIFICATION_LINK: verificationUrl,
                }
            };
            const kafkaMessage = {
                module: ModuleType.EMAIL,
                request
            }
            const kafkaService = KafkaService.getInstance();
            await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
            const resData = {
                ...newMember,
                verification_url: verificationUrl
            }
            this.sendResponse(StatusCode.SUCCESS, 'Signup successful. Please check your email to verify your account.',
                resData, null, res, ResponseStatus.SUCCESS);

        } catch (error) {
            console.error('Signup error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Signup failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async verifyEmail(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { token } = req.params;
            const member = await this.service.findByVerificationToken(token);

            if (!member) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid verification token', null, 'Token not found', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const verificationLogin = await MemberLoginsEntity.findOne({
                where: { member_id: member.id }
            });
            if (!verificationLogin || verificationLogin.token_expiry < new Date()) {
                this.sendResponse(StatusCode.FAILURE, 'Verification token expired', null, 'Token has expired', res, ResponseStatus.BAD_REQUEST);
                return;
            }


            await this.service.verifyEmail(member.id);
            const memberLogins = await this.service.findByMemberId(member.id);
            const responseData = { ...member, token: memberLogins.access_token } as any;
            this.sendResponse(StatusCode.SUCCESS, 'Email verified', responseData, null, res, ResponseStatus.SUCCESS);
            return;

        } catch (error) {
            console.error('Email verification error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Email verification failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async login(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { email, password } = req.body;

            // Find member by email
            const member = await this.service.findByEmail(email);
            if (!member) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid credentials', null, 'No account found with this email', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // If login is via OAuth only, tell the user to use that provider
            const googleLogin = await MemberLoginsEntity.findOne({ where: { provider: 'google', member_id: member.id } });
            const githubLogin = await MemberLoginsEntity.findOne({ where: { provider: 'github', member_id: member.id } });
            if (googleLogin || githubLogin) {
                const providerName = googleLogin ? 'Google' : 'GitHub';
                this.sendResponse(StatusCode.FAILURE, `${providerName} login required`, null, `Please sign in with ${providerName}`, res, ResponseStatus.BAD_REQUEST);
                return;
            }
            // Check if email is verified
            if (member.email_verification_pending) {
                this.sendResponse(StatusCode.FAILURE, 'Email verification pending', null, 'Please verify your email before logging in', res, ResponseStatus.HTTP_402);
                return;
            }
            if (!member.profile_complete) {
                const memberLogins = await this.service.findByMemberId(member.id);
                const responseData = { email: member.email, token: memberLogins.access_token, profile_complete: member.profile_complete } as any;
                this.sendResponse(StatusCode.SUCCESS, 'Profile Competion Pending', responseData, null, res, ResponseStatus.SUCCESS);
                return;
            }

            // Check if account is active
            if (!member.is_active) {
                this.sendResponse(StatusCode.FAILURE, 'Account deactivated', null, 'Your account has been deactivated', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Get password from member_logins table
            const passwordLogin = await this.service.findByPasswordLogin(member.id);
            if (!passwordLogin || !passwordLogin.password) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid credentials', null, 'Email or password is incorrect', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, passwordLogin.password);
            if (!isPasswordValid) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid credentials', null, 'Email or password is incorrect', res, ResponseStatus.BAD_REQUEST);
                return;
            }
            const apiKey = new APIKeyTokenService();
            await apiKey.createInitialApiKeyToken(member.id);
            await this.service.updateLastLogin(member.id);
            const tokenExpires = new Date();
            tokenExpires.setHours(tokenExpires.getHours() + 24);
            const token = createjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1

            });

            const refresh_token = refreshjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: token,
                refresh_token: refresh_token,
                token_expiry: tokenExpires
            });
            const companies = await this.service.getCompaniesForMember(member.id);
            if (companies.length === 0) {
                this.sendResponse(StatusCode.FAILURE, 'Login failed', null, 'You are not associated with any active company or your approval is pending.', res, ResponseStatus.BAD_REQUEST);
                return;
            }
            const responseData = { ...member, token, refresh_token, companies } as any;
            this.sendResponse(StatusCode.SUCCESS, 'Login successful', responseData, null, res, ResponseStatus.SUCCESS);

        } catch (error) {
            console.error('Login error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Login failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async resendVerification(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { email } = req.body;

            // Find member by email
            const member = await this.service.findByEmail(email);
            if (!member) {
                this.sendResponse(StatusCode.FAILURE, 'Email not found', null, 'No account found with this email', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Generate new verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = new Date();
            tokenExpires.setHours(tokenExpires.getHours() + 24);

            // Update verification token in member_logins table
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: verificationToken,
                token_expiry: tokenExpires
            });

            // Send verification email
            const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
            // const emailHtml = EmailTemplates.getEmailVerificationTemplate(email, verificationUrl, member.full_name);

            const request = {
                to: email,
                emailcode: 'VERIFY_EMAIL',
                variables: {
                    VERIFICATION_URL: verificationUrl,
                    NAME: member.full_name
                }
            };
            const kafkaMessage = {
                module: ModuleType.EMAIL,
                request
            }
            const kafkaService = KafkaService.getInstance();
            await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);

            this.sendResponse(StatusCode.SUCCESS, 'Verification email sent successfully', 'Verification email sent successfully' as any, null, res, ResponseStatus.SUCCESS);

        } catch (error) {
            console.error('Resend verification error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Failed to resend verification email', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    /**
     * API 1: Send password reset link to email
     */
    protected async forgotPassword(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { email } = req.body;

            if (!email) {
                this.sendResponse(StatusCode.FAILURE, 'Email is required', null, 'Email field is missing', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const member = await this.service.findByEmail(email);
            if (!member) {
                this.sendResponse(StatusCode.FAILURE, 'Email not found', null, 'No account found with this email', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            if (!member.is_active) {
                this.sendResponse(StatusCode.FAILURE, 'Account deactivated', null, 'Your account has been deactivated', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const googleLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'google' } });
            const githubLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'github' } });
            if (googleLogin || githubLogin) {
                const providerName = googleLogin ? 'Google' : 'GitHub';
                this.sendResponse(StatusCode.FAILURE, `${providerName} login required`, null, `Please sign in with ${providerName}`, res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Generate a secure reset token instead of a code
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenExpires = new Date();
            tokenExpires.setHours(tokenExpires.getHours() + 1); // Token expires in 1 hour
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: resetToken,
                token_expiry: tokenExpires
            });
            const resetPasswordUrl = `${FRONTENDDOMAIN}/reset-password/${resetToken}`;
            const request = {
                to: email,
                emailcode: 'PASSWORD_RESET',
                variables: {
                    VERIFICATION_LINK: resetPasswordUrl
                }
            };
            const kafkaMessage = {
                module: ModuleType.EMAIL,
                request
            }
            const VERIFICATION_LINK = {
                VERIFICATION_LINK: resetPasswordUrl
            }
            const kafkaService = KafkaService.getInstance();
            await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
            this.sendResponse(StatusCode.SUCCESS, 'Password reset link sent to your email',
                VERIFICATION_LINK as any, null, res, ResponseStatus.SUCCESS);

        } catch (error) {
            console.error('Forgot password error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Failed to send reset link', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }


    protected async forgotPasswordLinkVerify(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        const { reset_token } = req.body;

        if (!reset_token) {
            this.sendResponse(StatusCode.FAILURE, 'Reset token is required', null, 'Missing required fields', res, ResponseStatus.BAD_REQUEST);
            return;
        }

        // Find the reset token in member_logins table
        const resetLogin = await MemberLoginsEntity.findOne({
            where: {
                provider: 'email_verification',
                access_token: reset_token
            }
        });

        if (!resetLogin) {
            this.sendResponse(StatusCode.FAILURE, 'Invalid reset token', null, 'Reset token is incorrect', res, ResponseStatus.BAD_REQUEST);
            return;
        }

        if (resetLogin.token_expiry < new Date()) {
            this.sendResponse(StatusCode.FAILURE, 'Reset token expired', null, 'Reset token has expired', res, ResponseStatus.BAD_REQUEST);
            return;
        }

        this.sendResponse(StatusCode.SUCCESS, 'Reset token is valid', 'Reset token is valid' as any, null, res, ResponseStatus.SUCCESS);

    }

    /**
     * API 2: Reset password using token
     */
    protected async resetPassword(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { reset_token, new_password } = req.body;

            if (!new_password && reset_token) {
                const resetLogin = await MemberLoginsEntity.findOne({
                    where: {
                        provider: 'email_verification',
                        access_token: reset_token
                    }
                });
                if (!resetLogin) {
                    this.sendResponse(StatusCode.FAILURE, 'Reset Password Link is expired', null, 'Invalid reset link', res, ResponseStatus.BAD_REQUEST);
                    return;
                }
            }

            if (!reset_token || !new_password) {
                this.sendResponse(StatusCode.FAILURE, 'Reset token and new password are required', null, 'Missing required fields', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Find the reset token in member_logins table
            const resetLogin = await MemberLoginsEntity.findOne({
                where: {
                    provider: 'email_verification',
                    access_token: reset_token
                }
            });

            if (!resetLogin) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid reset token', null, 'Reset token is incorrect', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            if (resetLogin.token_expiry < new Date()) {
                this.sendResponse(StatusCode.FAILURE, 'Reset token expired', null, 'Reset token has expired', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Get member details
            const member = await this.service.findById(resetLogin.member_id);
            if (!member) {
                this.sendResponse(StatusCode.FAILURE, 'Member not found', null, 'Member associated with token not found', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            if (!member.is_active) {
                this.sendResponse(StatusCode.FAILURE, 'Account deactivated', null, 'Your account has been deactivated', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(new_password, saltRounds);

            await this.service.updatePasswordLogin(member.id, hashedPassword);
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: null,
                token_expiry: null // Clear the reset token after successful password reset
            });

            this.sendResponse(StatusCode.SUCCESS, 'Password reset successfully', 'Password reset successfully' as any, null, res, ResponseStatus.SUCCESS);

        } catch (error) {
            console.error('Reset password error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Failed to reset password', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async googleAuth(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            // Validate OAuth configuration first
            const configValidation = GoogleOAuth.validateConfiguration();
            if (!configValidation.isValid) {
                console.error('Google OAuth configuration errors:', configValidation.errors);
                this.sendResponse(StatusCode.FAILURE, 'Google OAuth not properly configured', null, configValidation.errors.join(', '), res, ResponseStatus.INTERNAL_ERROR);
                return;
            }

            // Use the same redirect URI that matches the callback endpoint
            const redirectUri = `${DEV_URL}/Infer/api/logins/google/callback`;
            const state = crypto.randomBytes(16).toString('hex'); // Generate state for security

            console.log('Initiating Google OAuth with redirect URI:', redirectUri);

            // Store state in session or cache for verification
            // For now, we'll use a simple approach
            const authUrl = GoogleOAuth.getAuthUrl(redirectUri, state);

            res.redirect(authUrl);
        } catch (error) {
            console.error('Google auth error:', error);
            this.sendResponse(StatusCode.FAILURE, 'Google authentication failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async googleCallback(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { code, state, error } = req.query;
            const genericResponse: GenericResponse<InferModel> = new GenericResponse<InferModel>()

            console.log('Google callback received:', {
                hasCode: !!code,
                hasState: !!state,
                hasError: !!error,
                query: req.query
            });

            if (error) {
                console.error('Google OAuth error from callback:', error);
                genericResponse.setStatus(StatusCode.FAILURE);
                genericResponse.setMsg('Google authentication failed');
                genericResponse.setError('User denied access');
                genericResponse.setData(null);
                const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                res.redirect(frontendUrl);
                return;
            }

            if (!code) {
                console.error('No authorization code received in callback');
                genericResponse.setStatus(StatusCode.FAILURE);
                genericResponse.setMsg('Authorization code missing');
                genericResponse.setError('No authorization code received');
                genericResponse.setData(null);
                const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                res.redirect(frontendUrl);
                return;
            }

            const redirectUri = `${DEV_URL}/Infer/api/logins/google/callback`;
            console.log('Using redirect URI for token exchange:', redirectUri);

            // Complete OAuth flow
            const userInfo: GoogleUserInfo = await GoogleOAuth.completeOAuthFlow(code as string, redirectUri);
            console.log('OAuth flow completed successfully for user:', userInfo.email);

            // STEP 1: Check if the email exists in the system
            let member = await this.service.findByEmail(userInfo.email);

            if (!member) {
                // Email not found → create member record (no email verification here)
                console.log('Creating new OAuth user with email:', userInfo.email);
                const memberData = {
                    email: userInfo.email,
                    full_name: userInfo.name,
                    profile_picture: userInfo.picture,
                    email_verification_pending: false,
                    is_active: true
                };

                member = await this.service.createMember(memberData);
                // Link Google provider for this member
                await this.service.updateOAuthInfo(member.id, 'google', userInfo.id);


                const verificationToken = crypto.randomBytes(32).toString('hex');
                const tokenExpires = new Date();
                tokenExpires.setHours(tokenExpires.getHours() + 24);

                await this.service.createOrUpdateLogin(member.id, {
                    provider: 'google',
                    access_token: verificationToken,
                    token_expiry: tokenExpires
                });

                const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
                res.redirect(verificationUrl);
                return;

            } else {
                // STEP 2: Email exists → check provider
                const passwordLogin = await this.service.findByPasswordLogin(member.id);
                if (passwordLogin && passwordLogin.password) {
                    genericResponse.setStatus(StatusCode.FAILURE);
                    genericResponse.setMsg('Email Is Already Registered With Email Password')
                    genericResponse.setError('Email Is Already Registered With Email Password');
                    genericResponse.setData(null);
                    const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                    const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                    res.redirect(frontendUrl);
                    return;
                }

                // Allow only if provider is Google for this account
                const googleLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'google' } });
                if (!googleLogin) {
                    genericResponse.setStatus(StatusCode.FAILURE);
                    genericResponse.setMsg('Email is registered with a different provider. Please use the original login method.');
                    genericResponse.setError('Email is registered with a different provider. Please use the original login method.');
                    genericResponse.setData(null);
                    const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                    const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                    res.redirect(frontendUrl);
                    return;
                }

                if (!member.profile_complete) {
                    const verificationToken = crypto.randomBytes(32).toString('hex');
                    const tokenExpires = new Date();
                    tokenExpires.setHours(tokenExpires.getHours() + 24);

                    await this.service.createOrUpdateLogin(member.id, {
                        provider: 'google',
                        access_token: verificationToken,
                        token_expiry: tokenExpires
                    });

                    const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
                    res.redirect(verificationUrl);
                    return;
                }
            }

            await this.service.updateLastLogin(member.id);
            const token = createjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            const refresh_token = refreshjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: token,
                refresh_token: refresh_token,
            });

            // generating api key during logged in with google
            const apiKeyTokenService = new APIKeyTokenService();
            await apiKeyTokenService.createInitialApiKeyToken(member.id);
            const companies = await this.service.getCompaniesForMember(member.id);
            const responseData = { ...member, token, refresh_token, companies } as any;
            genericResponse.setStatus(StatusCode.SUCCESS);
            genericResponse.setMsg('Login successful')
            genericResponse.setError(null);
            genericResponse.setData(responseData);
            genericResponse.setEncryptedData(EncryptionAndDecryption.encryption(responseData));
            const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
            const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
            console.log('Redirecting to frontend:', frontendUrl);
            res.redirect(frontendUrl);

        } catch (error: any) {
            console.error('Google callback error:', error);

            // Log additional error details
            if (error.response) {
                console.error('Error response details:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }

            const errorMsg = error.message || 'Internal server error';
            const genericResponse: GenericResponse<InferModel> = new GenericResponse<InferModel>();
            genericResponse.setStatus(StatusCode.FAILURE);
            genericResponse.setMsg('Google callback error');
            genericResponse.setError(errorMsg);
            genericResponse.setData(null);
            const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
            const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
            res.redirect(frontendUrl);
        }
    }

    protected async githubAuth(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            // Validate OAuth configuration first
            const configValidation = GithubOAuth.validateConfiguration();
            if (!configValidation.isValid) {
                console.error('GitHub OAuth configuration errors:', configValidation.errors);
                this.sendResponse(StatusCode.FAILURE, 'GitHub OAuth not properly configured', null, configValidation.errors.join(', '), res, ResponseStatus.INTERNAL_ERROR);
                return;
            }

            const redirectUri = `${DEV_URL}/infer/api/logins/github/callback`;
            const state = crypto.randomBytes(16).toString('hex'); // Generate state for security

            console.log('Initiating GitHub OAuth with redirect URI:', redirectUri);

            const authUrl = GithubOAuth.getAuthUrl(redirectUri, state);

            res.redirect(authUrl);
        } catch (error) {
            console.error('GitHub auth error:', error);
            this.sendResponse(StatusCode.FAILURE, 'GitHub authentication failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }

    protected async githubCallback(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { code, state, error } = req.query;
            const genericResponse: GenericResponse<InferModel> = new GenericResponse<InferModel>()

            console.log('GitHub callback received:', {
                hasCode: !!code,
                hasState: !!state,
                hasError: !!error,
                query: req.query
            });

            if (error) {
                console.error('GitHub OAuth error from callback:', error);
                genericResponse.setStatus(StatusCode.FAILURE);
                genericResponse.setMsg('GitHub authentication failed');
                genericResponse.setError('User denied access');
                genericResponse.setData(null);
                const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                res.redirect(frontendUrl);
                return;
            }

            if (!code) {
                console.error('No authorization code received in callback');
                genericResponse.setStatus(StatusCode.FAILURE);
                genericResponse.setMsg('Authorization code missing');
                genericResponse.setError('No authorization code received');
                genericResponse.setData(null);
                const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                res.redirect(frontendUrl);
                return;
            }

            const redirectUri = `${DEV_URL}/infer/api/logins/github/callback`;
            console.log('Using redirect URI for token exchange:', redirectUri);

            // Complete OAuth flow
            const userInfo: GithubUserInfo = await GithubOAuth.completeOAuthFlow(code as string, redirectUri);
            console.log('OAuth flow completed successfully for user:', userInfo.email);

            // STEP 1: Check if the email exists in the system
            let member = await this.service.findByEmail(userInfo.email);

            if (!member) {
                // Email not found → create member record
                console.log('Creating new OAuth user with email:', userInfo.email);
                const memberData = {
                    email: userInfo.email,
                    full_name: userInfo.name || userInfo.login,
                    profile_picture: userInfo.avatar_url,
                    email_verification_pending: false,
                    is_active: true
                };

                member = await this.service.createMember(memberData);
                // Link GitHub provider for this member
                await this.service.updateOAuthInfo(member.id, 'github', userInfo.id.toString());

                const verificationToken = crypto.randomBytes(32).toString('hex');
                const tokenExpires = new Date();
                tokenExpires.setHours(tokenExpires.getHours() + 24);

                await this.service.createOrUpdateLogin(member.id, {
                    provider: 'github',
                    access_token: verificationToken,
                    token_expiry: tokenExpires
                });

                const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
                res.redirect(verificationUrl);
                return;

            } else {
                // STEP 2: Email exists → check provider
                const passwordLogin = await this.service.findByPasswordLogin(member.id);
                if (passwordLogin && passwordLogin.password) {
                    genericResponse.setStatus(StatusCode.FAILURE);
                    genericResponse.setMsg('Email Is Already Registered With Email Password')
                    genericResponse.setError('Email Is Already Registered With Email Password');
                    genericResponse.setData(null);
                    const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                    const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                    res.redirect(frontendUrl);
                    return;
                }

                // Allow only if provider is GitHub for this account
                const githubLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'github' } });
                if (!githubLogin) {
                    genericResponse.setStatus(StatusCode.FAILURE);
                    genericResponse.setMsg('Email is registered with a different provider. Please use the original login method.');
                    genericResponse.setError('Email is registered with a different provider. Please use the original login method.');
                    genericResponse.setData(null);
                    const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
                    const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
                    res.redirect(frontendUrl);
                    return;
                }

                if (!member.profile_complete) {
                    const verificationToken = crypto.randomBytes(32).toString('hex');
                    const tokenExpires = new Date();
                    tokenExpires.setHours(tokenExpires.getHours() + 24);

                    await this.service.createOrUpdateLogin(member.id, {
                        provider: 'github',
                        access_token: verificationToken,
                        token_expiry: tokenExpires
                    });

                    const verificationUrl = `${FRONTENDURL}/registration/${verificationToken}`;
                    res.redirect(verificationUrl);
                    return;
                }
            }

            await this.service.updateLastLogin(member.id);
            const token = createjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            const refresh_token = refreshjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: token,
                refresh_token: refresh_token,
            });

            // generating api key during logged in with github
            const apiKeyTokenService = new APIKeyTokenService();
            await apiKeyTokenService.createInitialApiKeyToken(member.id);
            const companies = await this.service.getCompaniesForMember(member.id);
            const responseData = { ...member, token, refresh_token, companies } as any;
            genericResponse.setStatus(StatusCode.SUCCESS);
            genericResponse.setMsg('Login successful')
            genericResponse.setError(null);
            genericResponse.setData(responseData);
            genericResponse.setEncryptedData(EncryptionAndDecryption.encryption(responseData));
            const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
            const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
            console.log('Redirecting to frontend:', frontendUrl);
            res.redirect(frontendUrl);

        } catch (error: any) {
            console.error('GitHub callback error:', error);

            // Log additional error details
            if (error.response) {
                console.error('Error response details:', {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                });
            }
            const genericResponse: GenericResponse<InferModel> = new GenericResponse<InferModel>();
            genericResponse.setStatus(StatusCode.FAILURE);
            genericResponse.setMsg('GitHub callback error');
            genericResponse.setError(error.message || 'Internal server error');
            genericResponse.setData(null);
            const encryptedResponse = EncryptionAndDecryption.encryption(genericResponse);
            const frontendUrl = `${FRONTENDDOMAIN}/signin?token=${encryptedResponse}`;
            res.redirect(frontendUrl);
        }
    }

    protected async ssoLogin(req: express.Request, res: express.Response, _next: express.NextFunction): Promise<void> {
        try {
            const { keycloak_token } = req.body;

            if (!keycloak_token) {
                this.sendResponse(StatusCode.FAILURE, 'Keycloak token is required', null, 'Missing token', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            // Decode the Keycloak token
            const decodedToken = jwt.decode(keycloak_token) as any;

            if (!decodedToken || !decodedToken.email) {
                this.sendResponse(StatusCode.FAILURE, 'Invalid token', null, 'Token does not contain an email', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const email = decodedToken.email;
            let member = await this.service.findByEmail(email);

            if (!member) {
                // Email not found -> create member record
                const memberData = {
                    email: email,
                    full_name: decodedToken.name || decodedToken.preferred_username || email.split('@')[0],
                    email_verification_pending: false,
                    is_active: true
                };

                member = await this.service.createMember(memberData);
                
                // Link Keycloak provider for this member
                if (decodedToken.sub) {
                    await this.service.updateOAuthInfo(member.id, 'keycloak', decodedToken.sub);
                }
            } else {
                const keycloakLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'keycloak' } });
                if (!keycloakLogin && decodedToken.sub) {
                    // Update oauth info if logging in for the first time via keycloak but email already exists
                    await this.service.updateOAuthInfo(member.id, 'keycloak', decodedToken.sub);
                }
            }

            if (!member.profile_complete) {
                const token = createjwt({
                    member_id: member.id,
                    email: member.email,
                    role_id: 1
                });
                const responseData = { email: member.email, token: token, profile_complete: member.profile_complete } as any;
                this.sendResponse(StatusCode.SUCCESS, 'Profile Completion Pending', responseData, null, res, ResponseStatus.SUCCESS);
                return;
            }

            if (!member.is_active) {
                this.sendResponse(StatusCode.FAILURE, 'Account deactivated', null, 'Your account has been deactivated', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            await this.service.updateLastLogin(member.id);
            const token = createjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });
            const refresh_token = refreshjwt({
                member_id: member.id,
                email: member.email,
                role_id: 1
            });

            await this.service.createOrUpdateLogin(member.id, {
                provider: 'email_verification',
                access_token: token,
                refresh_token: refresh_token,
            });

            const apiKeyTokenService = new APIKeyTokenService();
            await apiKeyTokenService.createInitialApiKeyToken(member.id);
            const companies = await this.service.getCompaniesForMember(member.id);
            
            if (companies.length === 0) {
                this.sendResponse(StatusCode.FAILURE, 'Login failed', null, 'You are not associated with any active company or your approval is pending.', res, ResponseStatus.BAD_REQUEST);
                return;
            }

            const responseData = { ...member, token, refresh_token, companies } as any;
            this.sendResponse(StatusCode.SUCCESS, 'Login successful', responseData, null, res, ResponseStatus.SUCCESS);

        } catch (error: any) {
            console.error('SSO login error:', error);
            this.sendResponse(StatusCode.FAILURE, 'SSO login failed', null, 'Internal server error', res, ResponseStatus.INTERNAL_ERROR);
        }
    }
}
