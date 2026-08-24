
import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { JoinCompanyModel } from "../../database/repository/company/joinCompany/joinCompany.model";
import { JoinCompanyDto } from "../../database/repository/company/joinCompany/joinCompany.dto";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { CompanyEntity } from "../../entities/companyEntity";
import { RolesEntity } from "../../entities/rolesEntity";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { FileObject } from "../../core/FileModel";
import { MembersEntity } from "../../entities/membersEntity";
import { InviteEntity } from "../../entities/inviteEntity";
import { v4 as uuidv4 } from 'uuid';
class JoinCompanyService extends BaseServices {
    constructor(entity: any = CompanyMemberRolesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): JoinCompanyModel {
        return new JoinCompanyModel();
    }

    getDTO(): any {
        return JoinCompanyDto;
    }

    getModuleName(): string {
        return 'Join Company';
    }

    override createPreProcess(model: JoinCompanyModel, files: FileObject[] | null): Promise<InferModel> {
        return new Promise<InferModel>(async (resolve, reject) => {
            try {
                const uniqueCode = model.company_unique_id;
                if (!uniqueCode) {
                    return reject('E10001'); // Invalid Input
                }

                const company = await CompanyEntity.findOne({ where: { company_unique_id: uniqueCode } });
                if (!company) {
                    return reject('E10051');
                }

                const memberId = (model as any).decryptToken.member_id;
                if (!memberId) {
                    return reject('E10047'); // Unauthorized
                }

                // Check if already a member
                const existingMembership = await this.entity.findOne({
                    where: {
                        company_id: company.id,
                        member_id: memberId,
                        is_delete: 0
                    }
                });

                if (existingMembership) {
                    if (existingMembership.active) {
                        return reject(`E10057`); // Already a member (Need to ensure this error code exists or use string)
                    } else {
                        // If inactive, maybe reactivate? For now, just reject or update.
                        // Let's update to active.
                        model.id = existingMembership.id;
                        model.active = true;
                    }
                }

                // Find default role (DEVELOPER)
                const role = await RolesEntity.findOne({ where: { name: 'DEVELOPER' } });
                const roleId = role ? role.id : 2;

                model.company_id = company.id;
                model.member_id = memberId;
                model.role_id = roleId;
                model.default_company = false; // Or true if it's their first company?
                model.active = true;
                delete (model as any).company_unique_code;
                resolve(model);
            } catch (error) {
                reject(error);
            }
        });
    }

    override createPostProcess(result: any, model: InferModel, files: any): Promise<InferModel> {
        return new Promise(async (resolve, reject) => {
            const member = await MembersEntity.findOne({
                where: { id: result.member_id, is_delete: 0 }
            });

            if (!member) {
                return reject('E10047');
            }
            const joinedCompany = await CompanyEntity.findOne({
                where: { company_unique_id: result.company_unique_id, is_delete: 0 }
            });
            const invitedBy = joinedCompany?.created_by ?? result.member_id;
            await InviteEntity.save(
                InviteEntity.create({
                    company_unique_code: result.company_unique_id,
                    email: member.email,
                    status: 'active',
                    role_id: result.role_id,
                    created_by: invitedBy,
                    invite_token: uuidv4(),
                    company_member_role_id: result.id,
                })
            );
            // Return a success message or the created relationship
            (result as any).message = "Successfully joined the company.";
            resolve(result);
        });
    }
}

export default JoinCompanyService;
