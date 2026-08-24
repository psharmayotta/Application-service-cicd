import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { YottaOneIntegrationModel } from "../../database/repository/yottaOneIntegration/yottaOneIntegration.model";
import { YottaOneIntegrationDto } from "../../database/repository/yottaOneIntegration/yottaOneIntegration.dto";
import { MembersEntity } from "../../entities/membersEntity";
import { CompanyEntity } from "../../entities/companyEntity";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { InviteEntity } from "../../entities/inviteEntity";
import CompanyService from "../company/companyService.services";
import CompanyMemberRolesService from "../companyMemberRoles/companyMemberRolesService.services";
import Database from "../../database/database";
import * as bcrypt from "bcryptjs";
import { createjwt } from "../../utils/jwt/jwt";

class YottaOneIntegrationService extends BaseServices {
    private companyService: CompanyService;
    private companyMemberRolesService: CompanyMemberRolesService;

    constructor(entity: any = CompanyEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
        this.companyService = new CompanyService();
        this.companyMemberRolesService = new CompanyMemberRolesService();
    }

    getModel(): YottaOneIntegrationModel {
        return new YottaOneIntegrationModel();
    }

    getDTO(): any {
        return YottaOneIntegrationDto;
    }

    getModuleName(): string {
        return "Yotta One Integration";
    }

    private async resolveRbacRoleId(userRoles: any): Promise<number> {
        const DEFAULT_ROLE_ID = 2;
        try {
            const roles = Array.isArray(userRoles) ? userRoles : (userRoles ? [userRoles] : []);
            if (roles.length === 0) return DEFAULT_ROLE_ID;

            let roleName = String(roles[0] ?? '').trim().toLowerCase();
            if (!roleName) return DEFAULT_ROLE_ID;

            if (roleName === 'technical') roleName = 'technology';

            const db = Database.getInstance();
            const rows = await db.executeExternalQuery(
                `SELECT id FROM v0_dev_admin_yotta.rbac_roles WHERE LOWER(role_name) = $1 AND is_delete = 0 LIMIT 1`,
                [roleName]
            );

            if (rows && rows.length > 0 && rows[0].id != null) {
                return Number(rows[0].id);
            }
            return DEFAULT_ROLE_ID;
        } catch (error) {
            console.error('resolveRbacRoleId error:', error);
            return DEFAULT_ROLE_ID;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Helper: Find company by external_customer_id stored in metadata JSONB
    // ─────────────────────────────────────────────────────────────────────────────
    private async findCompanyByExternalCustomerId(externalCustomerId: string): Promise<CompanyEntity | null> {
        try {
            const db = Database.getInstance();
            const results = await db.executeExternalQuery(
                `SELECT * FROM v0_dev_yotta.company WHERE is_delete = 0 AND metadata->>'external_customer_id' = $1 LIMIT 1`,
                [externalCustomerId]
            );

            if (results && results.length > 0) {
                const row = results[0];
                const company = await CompanyEntity.findOne({ where: { id: row.id } });
                return company || null;
            }
            return null;
        } catch (error) {
            console.error('Error finding company by external_customer_id:', error);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Unified API: Generate Token
    // ─────────────────────────────────────────────────────────────────────────────
    async generateToken(model: YottaOneIntegrationModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const { username, password } = model as any;

                if (!username || !password) {
                    return reject('Username and password are required');
                }

                // Treat username as email for validation
                const member = await MembersEntity.findOne({ where: { email: username, is_delete: 0 } });
                if (!member) {
                    return reject('User not found');
                }

                if (!member.is_active) {
                    return reject('Account is not active');
                }

                const passwordLogin = await MemberLoginsEntity.findOne({ where: { member_id: member.id, provider: 'email_verification' } });
                if (!passwordLogin || !passwordLogin.password) {
                    return reject('Invalid credentials');
                }

                const isPasswordValid = await bcrypt.compare(password, passwordLogin.password);
                if (!isPasswordValid) {
                    return reject('Invalid credentials');
                }

                const token = createjwt({
                    member_id: member.id,
                    email: member.email,
                    role_id: member.role_id || 1
                });

                resolve({ access_token: token });
            } catch (error) {
                console.error('generateToken error:', error);
                reject(error);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Unified API: Sync External Customer (Onboard / Update User / Update Org / Update Address)
    // ─────────────────────────────────────────────────────────────────────────────
    async syncExtCustomer(model: YottaOneIntegrationModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                // Normalize flat OneYotta payload into nested format
                const raw = model as any;
                if (!raw.user && raw.user_email) {
                    raw.user = {
                        email: raw.user_email,
                        first_name: raw.user_fname || '',
                        last_name: raw.user_lname || '',
                        mobile_no: raw.user_mobile_no || '',
                        user_id: raw.user_id || '',
                        metadata: {
                            user_status: raw.user_status || '',
                            user_contact_status: raw.user_contact_status || '',
                            user_contact_crmid_uuid: raw.user_contact_crmid_uuid || '',
                            user_contact_type: raw.user_contact_type || [],
                            user_contact_crmid: raw.user_contact_crmid || '',
                            user_roles: raw.user_roles || [],
                            user_is_org: raw.user_is_org,
                            user_mobile_no: raw.user_mobile_no || '',
                            source: raw.source || '',
                            defaultUser: raw.defaultUser ?? false,
                        }
                    };
                    if (!raw.external_customer_id) {
                        raw.external_customer_id = raw.user_account_id || '';
                    }
                }

                const { user, organization_name, organizationName, name, company_name, companyName,
                    external_customer_id, is_kyc, isKYC, industry: topIndustry, metadata,
                    description, billing_address } = raw;

                const resolvedCompanyName = organization_name || organizationName || name || company_name || companyName || null;
                const resolvedIsKyc = is_kyc === true || is_kyc === 'true' || isKYC === true || isKYC === 'true';

                // 1. Process Member (User) if provided
                let member: MembersEntity | null = null;
                if (user && (user.email || user.username)) {
                    const email = (user.email || user.username || '').toLowerCase();
                    const first_name = user.first_name || '';
                    const last_name = user.last_name || '';
                    const full_name = (user.full_name || `${first_name} ${last_name}`).trim() || 'User';

                    const userMetadata = user.metadata || {};
                    const mobile_no = user.mobile_no || user.mobileNo || userMetadata.user_mobile_no || userMetadata.userMobileNo || null;
                    const user_id = user.external_user_id || user.user_id || user.userId || user.userUUID || userMetadata.user_id || userMetadata.userUUID || null;
                    const profile_picture = user.profile_picture || user.profilePicture || (user.avatar && user.avatar.image_url) || null;

                    const userExtraMetadata: any = { ...userMetadata };
                    if (user.external_user_id) userExtraMetadata.external_user_id = user.external_user_id;
                    for (const key of Object.keys(user)) {
                        if (!['email', 'username', 'first_name', 'last_name', 'full_name', 'mobile_no', 'mobileNo', 'user_id', 'userId', 'userUUID', 'external_user_id', 'profile_picture', 'profilePicture', 'avatar', 'metadata'].includes(key)) {
                            userExtraMetadata[key] = user[key];
                        }
                    }

                    member = await MembersEntity.findOne({ where: { email } });

                    if (member && !external_customer_id) {
                        return reject('E10071');
                    }

                    if (!member) {
                        member = new MembersEntity();
                        member.email = email;
                        member.full_name = full_name;
                        member.mobile_no = mobile_no;
                        member.user_id = user_id;
                        member.profile_picture = profile_picture;
                        member.email_verification_pending = false;
                        member.profile_complete = true;
                        member.is_active = true;
                        member.metadata = userExtraMetadata;
                        member.role_id = 1;
                        await member.save();
                    } else {
                        if (first_name || last_name) member.full_name = full_name || member.full_name;
                        if (mobile_no) member.mobile_no = mobile_no;
                        if (user_id) member.user_id = user_id;
                        if (profile_picture) member.profile_picture = profile_picture;
                        member.profile_complete = true;
                        member.metadata = { ...(member.metadata || {}), ...userExtraMetadata };
                        await member.save();
                    }
                } else if (user) {
                    return reject('E10066'); // User object provided but email missing
                }

                // 2. Process Company (Organization)
                let company: CompanyEntity | null = null;
                
                if (external_customer_id) {
                    company = await this.findCompanyByExternalCustomerId(external_customer_id);
                }

                if (!company && resolvedCompanyName) {
                    company = await CompanyEntity.findOne({ where: { company_name: resolvedCompanyName } });
                }

                if (!company && !resolvedCompanyName && !external_customer_id) {
                    return reject('E10067'); // Org Name or Ext ID required
                }

                let companyExtraMetadata: any = {};
                if (company) {
                    companyExtraMetadata = company.metadata || {};
                    if (metadata) {
                        companyExtraMetadata = { ...companyExtraMetadata, ...metadata };
                    }
                } else if (metadata) {
                    companyExtraMetadata = { ...metadata };
                }

                if (external_customer_id) companyExtraMetadata.external_customer_id = external_customer_id;
                if (description !== undefined) companyExtraMetadata.description = description;
                if (billing_address !== undefined) companyExtraMetadata.billing_address = billing_address;

                if (!company) {
                    const companyEmail = user ? ((user.email || user.username || '').split('@')[1] || null) : null;
                    const industry = topIndustry || companyExtraMetadata.industry || companyExtraMetadata.yottaindustry__c || 'Technology';
                    
                    const companyData = {
                        company_name: resolvedCompanyName || external_customer_id,
                        industry: industry,
                        company_email: companyEmail,
                        is_active: true,
                        is_kyc: is_kyc !== undefined || isKYC !== undefined ? resolvedIsKyc : false,
                        metadata: companyExtraMetadata
                    };

                    company = await this.companyService.createCompany(companyData, {
                        member_id: member ? member.id : 1,
                        role_id: 1,
                        default_company: true,
                        active: true
                    });
                } else {
                    if (topIndustry || (metadata && metadata.industry)) company.industry = topIndustry || (metadata && metadata.industry) || company.industry;
                    if (is_kyc !== undefined || isKYC !== undefined) company.is_kyc = resolvedIsKyc;
                    company.metadata = companyExtraMetadata;
                    await company.save();
                }

                // 3. Link Member and Company
                if (member && company) {
                    member.company_id = company.id;

                    const userRoles = (member.metadata && member.metadata.user_roles) || [];
                    const roleId = await this.resolveRbacRoleId(userRoles);

                    member.role_id = roleId;
                    await member.save();

                    const existingMapping = await CompanyMemberRolesEntity.findOne({
                        where: { company_id: company.id, member_id: member.id }
                    });

                    if (!existingMapping) {
                        await this.companyMemberRolesService.assignMemberRole({
                            company_id: company.id,
                            member_id: member.id,
                            role_id: roleId,
                            default_company: true,
                            active: true
                        });
                    } else if (existingMapping.role_id !== roleId) {
                        existingMapping.role_id = roleId;
                        await existingMapping.save();
                    }
                }

                // 3b. If user_status is Active, update pending invites to active
                if (member && company && user?.metadata?.user_status?.toLowerCase() === 'active') {
                    const pendingInvites = await InviteEntity.find({
                        where: {
                            email: member.email,
                            company_unique_code: company.company_unique_id,
                            status: 'pending',
                            is_delete: 0,
                        }
                    });
                    for (const invite of pendingInvites) {
                        invite.status = 'active';
                        await invite.save();
                    }
                    // Also ensure member is marked active
                    if (!member.is_active) {
                        member.is_active = true;
                        await member.save();
                    }
                }

                // 4. Construct Response
                const responseData: any = {
                    organizationName: company.company_name,
                    organizationUUID: company.company_unique_code,
                    organizationID: company.id.toString(),
                    external_customer_id: external_customer_id || company.metadata?.external_customer_id || null,
                    is_kyc: company.is_kyc,
                    industry: company.industry,
                    metadata: company.metadata
                };

                if (member) {
                    responseData.userEmail = member.email;
                    responseData.userFullName = member.full_name;
                    responseData.userMobile = member.mobile_no || '';
                    responseData.userId = member.user_id || '';
                    responseData.memberId = member.id;
                    responseData.profile_complete = member.profile_complete;
                }

                resolve(responseData);
            } catch (error) {
                console.error('Sync external customer error:', error);
                reject(error);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // API #5: Get Customer by external_customer_id
    // ─────────────────────────────────────────────────────────────────────────────
    async getExtCustomer(model: YottaOneIntegrationModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const externalCustomerId = (model as any).external_customer_id;

                if (!externalCustomerId) {
                    return reject('E10068');
                }

                // 1. Find the company by external_customer_id
                const company = await this.findCompanyByExternalCustomerId(externalCustomerId);
                if (!company) {
                    return reject('E10069');
                }

                // 2. Fetch members linked to this company
                const memberMappings = await CompanyMemberRolesEntity.find({
                    where: { company_id: company.id, is_delete: 0 }
                });

                const memberIds = memberMappings
                    .map(m => m.member_id)
                    .filter((id): id is number => id !== null && id !== undefined);

                let members: any[] = [];
                if (memberIds.length > 0) {
                    const memberEntities = await Promise.all(
                        memberIds.map(id => MembersEntity.findOne({ where: { id, is_delete: 0 } }))
                    );

                    members = memberEntities
                        .filter(m => m !== null)
                        .map(m => {
                            const mapping = memberMappings.find(mm => mm.member_id === m!.id);
                            return {
                                memberId: m!.id,
                                email: m!.email,
                                full_name: m!.full_name,
                                mobile_no: m!.mobile_no || null,
                                user_id: m!.user_id || null,
                                is_active: m!.is_active,
                                role_id: mapping?.role_id || null,
                                metadata: m!.metadata || {}
                            };
                        });
                }

                // 3. Construct response
                const companyMeta = company.metadata || {};
                const responseData = {
                    exists: true,
                    organizationName: company.company_name,
                    organizationUUID: company.company_unique_code,
                    organizationID: company.id.toString(),
                    external_customer_id: externalCustomerId,
                    is_kyc: company.is_kyc,
                    is_active: company.is_active,
                    industry: company.industry,
                    description: companyMeta.description || null,
                    billing_address: companyMeta.billing_address || null,
                    metadata: companyMeta,
                    members: members,
                    created_at: company.created_at,
                    modified_at: company.modified_at
                };

                resolve(responseData);
            } catch (error) {
                console.error('Get external customer error:', error);
                reject(error);
            }
        });
    }
}

export default YottaOneIntegrationService;
