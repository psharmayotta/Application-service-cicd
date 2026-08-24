import * as crypto from 'crypto';
import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ForgotPasswordModel } from "../../database/repository/login/forgotPassword/forgotPassword.model";
import { ForgotPasswordDto } from "../../database/repository/login/forgotPassword/forgotPassword.dto";
import { MembersEntity } from "../../entities/membersEntity";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { EmailService } from "../../utils/email/emailService";

class ForgotPasswordService extends BaseServices {
    constructor(entity: any = MemberLoginsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ForgotPasswordModel {
        return new ForgotPasswordModel();
    }

    getDTO() {
        return ForgotPasswordDto;
    }

    async forgotPassword(model: ForgotPasswordModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const { email } = model;
                const member = await this.entity.findOneBy({ email });
                if (!member) {
                    return reject('E10015');
                }
                if (!member.is_active) {
                    return reject('E10016');
                }
                const resetToken = crypto.randomBytes(32).toString('hex');
                const tokenExpires = new Date();
                tokenExpires.setHours(tokenExpires.getHours() + 1);

                const existing = await this.entity.findOne({ where: { member_id: member.id, provider: 'email_verification' } });
                if (existing) {
                    await this.entity.update(existing.id, {
                        access_token: resetToken,
                        token_expiry: tokenExpires
                    });
                    return await this.entity.findOneBy({ id: existing.id }) as MemberLoginsEntity;
                }
                const resetPasswordUrl = `https://devq0ui.asmadiya.net/reset-password/${resetToken}`;

                // Email HTML content
                const emailHtml = `
            <h2>Password Reset Request</h2>
            <p>Hello ${member.full_name || 'User'},</p>
            <p>You have requested to reset your password. Click the button below to proceed:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetPasswordUrl}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Reset Password
                </a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetPasswordUrl}</p>
        `;

                // Email data
                const emailData = {
                    email,
                    cc: "sinusharma12@yopmail.com",
                    subject: 'Password Reset Request',
                    html: emailHtml,
                };

                // Send email
                await EmailService.sendEmail(emailData);

                resolve('Password reset link sent to your email');
            } catch (error) {
                reject(error);
            }
        });
    }
}
export default ForgotPasswordService;
