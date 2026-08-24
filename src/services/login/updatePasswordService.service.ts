import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { MembersEntity } from "../../entities/membersEntity";
import { UpdatePasswordModel } from "../../database/repository/login/updatePassword/updatePassword.model";
import { UpdatePasswordDto } from "../../database/repository/login/updatePassword/updatePassword.dto";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import * as bcrypt from 'bcryptjs';

class UpdatePasswordService extends BaseServices {
    constructor(entity: any = MembersEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): UpdatePasswordModel {
        return new UpdatePasswordModel();
    }

    getDTO(): any {
        return UpdatePasswordDto;
    }

    getModuleName(): string {
        return 'Update Password';
    }

    async updatePassword(model: UpdatePasswordModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const memberId = model.decryptToken.member_id;
                const { oldPassword, newPassword, confirmPassword } = model;

                if (newPassword !== confirmPassword) {
                    return reject('E10020');
                }

                // Get password login
                const passwordLogin = await MemberLoginsEntity.findOne({
                    where: {
                        member_id: memberId,
                        provider: 'email_verification'
                    }
                });

                if (!passwordLogin || !passwordLogin.password) {
                    return reject('E10021'); // Password not found
                }

                // Verify old password
                const isPasswordValid = await bcrypt.compare(oldPassword, passwordLogin.password);
                if (!isPasswordValid) {
                    return reject('E10048'); // Invalid old password
                }

                // Hash new password
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

                // Update password
                passwordLogin.password = hashedPassword;
                await MemberLoginsEntity.save(passwordLogin);

                resolve({ message: 'Password updated successfully' });

            } catch (error) {
                reject(error);
            }
        });
    }
}

export default UpdatePasswordService;
