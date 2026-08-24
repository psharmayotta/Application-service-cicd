import * as bcrypt from 'bcryptjs';
import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ResetPasswordModel } from "../../database/repository/login/resetPassword/resetPassword.model";
import { ResetPasswordDto } from "../../database/repository/login/resetPassword/resetPassword.dto";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";

class ResetPasswordService extends BaseServices {
    constructor(entity: any = MemberLoginsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ResetPasswordModel {
        return new ResetPasswordModel();
    }

    getDTO() {
        return ResetPasswordDto;
    }


    async resetPassword(model: ResetPasswordModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const resetLogin = await this.entity.findOne({
                    where: {
                        provider: 'email_verification',
                        access_token: model.reset_token
                    }
                });
                if (!resetLogin) {
                    reject('E10017');
                }
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(model.newPassword, saltRounds);

                await this.entity.update(resetLogin.id, {
                    password: hashedPassword, access_token: null,
                    token_expiry: null
                });
                resolve('Password reset successfully');
            } catch (error) {
                reject(error);
            }
        });
    }

}

export default ResetPasswordService;
