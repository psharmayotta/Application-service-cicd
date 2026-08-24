import { AwsService } from "../../core/AwsService";
import { FileObject } from "../../core/FileModel";
import { MetaModel } from "../../core/MetaModel";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { MemberDto } from "../../database/repository/userManagement/member.dto";
import { MemberModel } from "../../database/repository/userManagement/member.model";
import { CompanyEntity } from "../../entities/companyEntity";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { RolesEntity } from "../../entities/rolesEntity";
import { BaseServices } from "../baseService.services";
import CompanyMemberRolesService from "../companyMemberRoles/companyMemberRolesService.services";
import MemberLoginsService from "../memberLogins/memberLoginsService.services";
import AuditLogService from "../auditLog/auditLogService.services";

class MemberService extends BaseServices {
    constructor(entity: any = MembersEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }
    private companyMemberRolesService = new CompanyMemberRolesService();
    private memberLoginsService = new MemberLoginsService();

    getModel(): MemberModel {
        return new MemberModel();
    }

    getDTO() {
        return MemberDto;
    }

    getMetaModel(): MetaModel {
        return new MetaModel("members", "profile_picture", [
            {
                fileKey: "files",
                allowedSize: 1024 * 1024 * 5,
                require: "false",
                allowedExtensions: [
                    "image/png",
                    "image/jpg",
                    "image/jpeg",
                    "image/webp",
                ],
                colName: "profile_picture",
            },
        ]);
    }

    async postProcessGetById(result: any): Promise<any> {
        if (!result || !(result as any).decryptToken.member_id) {
            return Promise.reject('E10047');
        }
        try {
            const memberId = (result as any).decryptToken.member_id;
            const memberDetails = await MembersEntity.findOne({ where: { id: memberId } });
            const roleDetails = await RolesEntity.findOne({ where: { id: memberDetails.role_id } });
            if (memberDetails) {
                (result as any).id = memberDetails.id;
                (result as any).email = memberDetails.email;
                (result as any).role = roleDetails.name;
                (result as any).full_name = memberDetails.full_name;
                (result as any).mobile_no = memberDetails.mobile_no;
                // (result as any).profile_picture = memberDetails.profile_picture;
                const profilePic = memberDetails.profile_picture;
                if (!profilePic || profilePic.trim() === "") {
                    // null or empty → return as it is
                    (result as any).profile_picture = null;
                    (result as any).profile_picture_url = null;

                } else if (
                    profilePic.startsWith("http://") ||
                    profilePic.startsWith("https://")
                ) {
                    // already an icon / absolute URL
                    (result as any).profile_picture = profilePic;
                    (result as any).profile_picture_url = profilePic;

                } else {
                    // only filename → generate signed URL
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "members",
                            memberDetails.id,
                            profilePic
                        );
                        (result as any).profile_picture = profilePic;
                        (result as any).profile_picture_url = signedUrl;
                    } catch {
                        (result as any).profile_picture_url = null;
                    }
                }

                (result as any).last_login = memberDetails.last_login;
                (result as any).is_active = memberDetails.is_active;
                (result as any).user_id = memberDetails.user_id;

                const memberLogin = await MemberLoginsEntity.findOne({ where: { member_id: memberId } });
                if (memberLogin) {
                    (result as any).provider = memberLogin.provider;
                }
            }
            if (result.company_id) {
                const company = await CompanyEntity.findOne({ where: { id: result.company_id } });
                (result as any).role = company.created_by == memberId ? "admin" : "developer";
            }
            const companies = await this.companyMemberRolesService.getCompaniesForMember(memberId);
            (result as any).companies = companies;
            delete (result as any).decryptToken;
        } catch (error) {
            return Promise.reject('E10032');

        }
        return result;
    }


    override createPreProcess(model: MemberModel, files: FileObject[] | null): Promise<MemberModel> {
        return new Promise<MemberModel>(async (resolve, reject) => {
            try {
                const member = await this.entity.findOneBy({ id: model.decryptToken.member_id });
                const userId = await this.entity.findOneBy({ user_id: model.user_id });
                let finalModel: any = { ...model };
                if (!member) {
                    return reject('E10047');
                }
                if (userId && model.user_id !== undefined) {
                    return reject('E10050');
                }
                finalModel.id = member.id;
                finalModel.user_id = model.user_id;
                resolve(this.transformModel(finalModel));
            } catch (error) {
                reject(error);
            }
        });
    }

    override async createPostProcess(result: MemberModel, model: MemberModel, files: any): Promise<MemberModel> {
        const memberId = model.decryptToken?.member_id;
        
        let actions: string[] = [];
        if (files && files.length > 0) {
            actions.push("Updated profile picture");
        }
        if (model.full_name) {
            actions.push(`Updated name to "${model.full_name}"`);
        }
        if (model.mobile_no) {
            actions.push(`Updated mobile number`);
        }
        if (model.user_id) {
            actions.push(`Updated user ID to "${model.user_id}"`);
        }
        
        if (actions.length > 0) {
            await AuditLogService.log({
                company_id: Number(result.company_id),
                member_id: memberId,
                module: 'My Account',
                action: 'UPDATE',
                entity_type: 'MembersEntity',
                entity_id: result.id,
                entity_name: result.full_name || 'Member',
                description: actions.join(', '),
                ip_address: '',
            });
        }
        
        return result;
    }

    override updateDeleteFlagData = async (data: any): Promise<boolean> => {
        try {
            const whereid = await this.updateDeleteFlagPreProcess(data);
            if (whereid === null) {
                return false;
            } else {
                const record = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
                if (record != '' && record != null) {
                    await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();
                    
                    const memberId = data.decryptToken?.member_id;
                    await AuditLogService.log({
                        company_id: null as any,
                        member_id: memberId,
                        module: 'My Account',
                        action: 'DELETE',
                        entity_type: 'MembersEntity',
                        entity_id: data.id,
                        entity_name: `Member-${data.id}`,
                        description: `Deleted the account`,
                        ip_address: '',
                    });
                    
                    return true;
                } else {
                    return false;
                }
            }
        } catch (error) {
            console.error('-------MemberService updateDeleteFlagData error---------', error);
            throw error;
        }
    };

    override async filterFileData(files: FileObject[] | null, fileFieldName: string): Promise<any> {
        let filterFile = null
        if (files) {

            filterFile = files;
        }
        return Promise.resolve(filterFile)
    }

    override async transformFileData(model: MemberModel, files: any): Promise<any> {
        try {
            let fileData: any = { ...model };

            if (files && files.length > 0 && files[0]?.files) {
                fileData.profile_picture = files[0].files;
            }

            return fileData;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override  transformModel(model: MemberModel): MemberModel {
        return model;
    }



    async findByEmail(email: string): Promise<MembersEntity | null> {
        const result = this.entity.findOneBy({ email });
        return result || null;
    }

    async findById(memberId: number): Promise<MembersEntity | null> {
        return await this.entity.findOneBy({ id: memberId });
    }

    async getAdminRoleId(): Promise<number> {
        const adminRole = await RolesEntity.findOne({
            where: { name: 'super_user' }
        });

        if (!adminRole) {
            throw new Error('Admin role not found in database');
        }

        return adminRole.id;
    }

    async findByVerificationToken(token: string): Promise<MembersEntity | null> {
        const login = await this.memberLoginsService.findWithMemberByAccessToken(token);
        return login?.member || null;
    }

    async createMember(memberData: any): Promise<MembersEntity> {
        const member = this.entity.create(memberData);
        const savedMember = await this.entity.save(member);
        return Array.isArray(savedMember) ? savedMember[0] : savedMember;
    }

    async verifyEmail(memberId: number): Promise<void> {
        await MembersEntity.update(memberId, {
            email_verification_pending: false
        });
    }


    async updateLastLogin(memberId: number): Promise<void> {
        await MembersEntity.update(memberId, {
            last_login: new Date()
        });
    }

    async updateMember(memberId: number, updateData: any): Promise<void> {
        await MembersEntity.update(memberId, updateData);
    }

    async createOrUpdateLogin(memberId: number, loginData: any): Promise<MemberLoginsEntity> {
        const existing = await this.memberLoginsService.findByMemberAndProvider(memberId, loginData.provider);
        if (existing) {
            return await this.memberLoginsService.updateById(existing.id, loginData);
        }
        return await this.memberLoginsService.createLogin({ member_id: memberId, ...loginData });
    }

    async findByOAuthId(oauthProvider: string, oauthId: string): Promise<MembersEntity | null> {
        const login = await this.memberLoginsService.findByProviderAndUserIdWithMember(oauthProvider, oauthId);
        return login?.member || null;
    }

    async findByPasswordLogin(memberId: number): Promise<MemberLoginsEntity | null> {
        return await this.memberLoginsService.findByMemberEmailPassword(memberId);
    }

    async findByMemberId(memberId: number): Promise<MemberLoginsEntity | null> {
        return await this.memberLoginsService.findByMemberId(memberId);
    }

    async createPasswordLogin(memberId: number, hashedPassword: string): Promise<MemberLoginsEntity> {
        return await this.memberLoginsService.createPasswordLogin(memberId, hashedPassword);
    }

    async updateOAuthInfo(memberId: number, oauthProvider: string, oauthId: string, accessToken?: string, refreshToken?: string): Promise<void> {
        await this.createOrUpdateLogin(memberId, {
            provider: oauthProvider,
            provider_user_id: oauthId,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expiry: accessToken ? new Date(Date.now() + 3600000) : null // 1 hour expiry
        });
    }

    async findByResetCode(memberId: number, resetCode: string): Promise<MemberLoginsEntity | null> {
        return await this.memberLoginsService.findByResetCode(memberId, resetCode);
    }

    async updatePasswordLogin(memberId: number, hashedPassword: string): Promise<void> {
        await this.memberLoginsService.updatePasswordLogin(memberId, hashedPassword);
        
        await AuditLogService.log({
            company_id: null,
            member_id: memberId,
            module: 'My Account',
            action: 'UPDATE',
            entity_type: 'MembersEntity',
            entity_id: memberId,
            entity_name: `Member-${memberId}`,
            description: `Updated the password`,
            ip_address: '',
        });
    }

    async assignMemberRole(params: { company_id: number | null; member_id: number; role_id: number; default_company?: boolean; active?: boolean }): Promise<CompanyMemberRolesEntity> {
        return await this.companyMemberRolesService.assignMemberRole(params);
    }

    async clearResetTokens(memberId: number): Promise<void> {
        await this.memberLoginsService.clearResetTokens(memberId);
    }

    async getCompaniesForMember(memberId: number): Promise<any[]> {
        return await this.companyMemberRolesService.getCompaniesForMember(memberId);
    }

    async emailAlreadyexist(model: MemberModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.entity.findOneBy({ email: model.email });
                if (result) {
                    return reject(`E10014`);
                }
                resolve("Email not found you can proceed");
            } catch (error) {
                reject(error);
            }
        });
    }

    async getRolePermissions(roleId: number): Promise<any> {
        try {
            const db = (await import('../../database/database')).default.getInstance();
            const result = await db.executeExternalQuery(`
                SELECT 
                    r.id as role_id,
                    r.role_name,
                    r.description as role_description,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'module_id', m.id,
                                'module_name', m.module_name,
                                'route_path', m.route_path,
                                'description', m.description,
                                'read', rp.read,
                                'write', rp.write
                            ) ORDER BY m.id
                        ) FILTER (WHERE m.id IS NOT NULL),
                        '[]'
                    ) as modules
                FROM v0_dev_admin_yotta.rbac_roles r
                LEFT JOIN v0_dev_admin_yotta.rbac_role_permissions rp ON rp.role_id = r.id AND rp.is_delete = 0
                LEFT JOIN v0_dev_admin_yotta.rbac_modules m ON m.id = rp.module_id AND m.is_delete = 0
                WHERE r.id = $1
                    AND r.is_delete = 0
                GROUP BY r.id, r.role_name, r.description
            `, [roleId]);

            if (!result || result.length === 0) {
                return Promise.reject('E10001');
            }

            return result[0];
        } catch (error) {
            console.error('getRolePermissions error:', error);
            return Promise.reject('E10005');
        }
    }
}

export default MemberService;