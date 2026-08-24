import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { CompanyEntity } from "../../entities/companyEntity";
import { CompanyRoleMapperEntity } from "../../entities/companyRoleMapperEntity";
import { RolesEntity } from "../../entities/rolesEntity";
import { CompanyModel } from "../../database/repository/company/company.model";
import { CompanyDto } from "../../database/repository/company/company.dto";
import { getRepository } from "typeorm";
import CompanyMemberRolesService from "../companyMemberRoles/companyMemberRolesService.services";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { FileObject } from "../../core/FileModel";
import { ErrorCodes } from "../../core/ErrorCodes";
import { PricePlanEntity } from "../../entities/pricePlanEntity";
import Database from '../../database/database';
import { InferParams, Pagination } from "../../core/InferParams";
import APIKeyTokenService from "../apiKeyToken/apiKeyTokenService.services";
import { WalletEntity } from "../../entities/walletEntity";
import { WalletTransactionEntity } from "../../entities/walletTransactionsEntity";
import { WalletStatus, WalletTxnStatus, WalletTxnReferenceType, WalletTxnType } from "../../config";
import AuditLogService from "../auditLog/auditLogService.services";

class CompanyService extends BaseServices {
    constructor(entity: any = CompanyEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }
    private companyMemberRolesService = new CompanyMemberRolesService();

    getModel(): CompanyModel {
        return new CompanyModel();
    }

    getDTO() {
        return CompanyDto;
    }

    getModuleName(): string {
        return 'Organization';
    }

    async createPreProcess(model: CompanyModel, files: FileObject[] | null): Promise<InferModel> {
        return new Promise<InferModel>(async (resolve, reject) => {
            try {
                if (model.id) {
                    const company = await this.entity.findOneBy({ id: model.id, is_delete: 0 });
                    if (!company) {
                        return reject('E10001');
                    }

                    const companyWithSameName = await this.entity.findOneBy({ company_name: model.company_name });
                    if (companyWithSameName && companyWithSameName.id !== model.id) {
                        return reject('E10013');
                    }

                    const decryptToken = model.decryptToken;
                    Object.assign(model, company, {
                        company_name: model.company_name,
                        decryptToken,
                    });
                    (model as any).previous_company_name = company.company_name;
                    return resolve(this.transformModel(model));
                }

                const existingCompany = await this.entity.findOneBy({ company_name: model.company_name });
                if (existingCompany) {
                    return reject('E10013');
                }

                // Set default price plan
                const defaultPlan = await PricePlanEntity.findOneBy({ is_default: true });
                if (defaultPlan) {
                    model.price_plan_id = defaultPlan.id;
                }

                // Generate company_unique_code if not present
                if (!model.company_unique_code || model.company_unique_code === '') {
                    const randomUuid: string = (global as any).crypto?.randomUUID
                        ? (global as any).crypto.randomUUID()
                        : require('crypto').randomUUID();
                    model.company_unique_code = randomUuid;
                }

                const random4Digits = Math.floor(1000 + Math.random() * 9000);
                model.company_unique_id = `Q0${random4Digits} ${model.company_name}`;

                if (model.decryptToken && model.decryptToken.member_id) {
                    model.created_by = model.decryptToken.member_id;
                }

                resolve(this.transformModel(model));
            } catch (error) {
                reject(error);
            }
        });
    }


    override createPostProcess(result: CompanyModel, model: CompanyModel, files: any): Promise<CompanyModel> {
        return new Promise(async (resolve, reject) => {
            try {
                const companyRecord: CompanyEntity = result as any;

                if (model.id) {
                    const previousCompanyName = (model as any).previous_company_name || 'Organisation';
                    await AuditLogService.log({
                        company_id: companyRecord.id,
                        member_id: model.decryptToken?.member_id || companyRecord.created_by,
                        module: this.getModuleName(),
                        action: 'UPDATE',
                        entity_type: 'CompanyEntity',
                        entity_id: companyRecord.id,
                        entity_name: previousCompanyName,
                        description: `${previousCompanyName} has been updated to ${companyRecord.company_name}`,
                        ip_address: '',
                    });
                    return resolve(result);
                }

                // Map default active roles to the new company
                const defaultRoles = await RolesEntity.find({ where: { active: true } });
                if (defaultRoles && defaultRoles.length > 0) {
                    for (const role of defaultRoles) {
                        const mapping = CompanyRoleMapperEntity.create({
                            company_id: companyRecord.id,
                            role_id: role.id,
                            active: true
                        });
                        // await CompanyRoleMapperEntity.save(mapping);
                    }
                }

                // Assign creator role
                if (companyRecord && companyRecord.id && model.decryptToken && model.decryptToken.member_id) {
                    const memberId = model.decryptToken.member_id;
                    const roleId = model.role_id || model.decryptToken.role_id; // Prefer body role_id if set? Or token?

                    if (memberId && roleId) {
                        await this.companyMemberRolesService.assignMemberRole({
                            company_id: companyRecord.id,
                            member_id: memberId,
                            role_id: roleId,
                            default_company: false, // Or true? Original code said false.
                            active: true,
                        });
                    }
                }

                const apiKeyTokenService = new APIKeyTokenService();
                await apiKeyTokenService.createInitialApiKeyToken(model.decryptToken.member_id);

                // Initialize Wallet with Signup Bonus
                await this.initializeCompanyWallet(companyRecord.id, model.decryptToken.member_id, companyRecord.price_plan_id);

                await AuditLogService.log({
                    company_id: companyRecord.id,
                    member_id: model.decryptToken?.member_id || companyRecord.created_by,
                    module: this.getModuleName(),
                    action: 'CREATE',
                    entity_type: 'CompanyEntity',
                    entity_id: companyRecord.id,
                    entity_name: companyRecord.company_name,
                    description: `Created a organization`,
                    ip_address: '',
                });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }


    private async initializeCompanyWallet(companyId: number, memberId: number, pricePlanId: number): Promise<void> {
        try {

            const existingWallet = await WalletEntity.findOneBy({ company_id: companyId });
            if (existingWallet) {
                console.log(`[Wallet] Wallet already exists for company ID: ${companyId}. Skipping initialization.`);
                return;
            }
            const pricePlan = await PricePlanEntity.findOneBy({ id: pricePlanId });
            const signupBonus = pricePlan ? Number(pricePlan.signup_bonus) : 0;

            const wallet = new WalletEntity();
            wallet.company_id = companyId;
            wallet.user_id = memberId;
            wallet.balance = signupBonus;
            wallet.currency = pricePlan?.currency || 'INR';
            wallet.status = WalletStatus.ACTIVE;
            await wallet.save();

            if (signupBonus > 0) {
                const company = await CompanyEntity.findOneBy({ id: companyId });

                const transaction = new WalletTransactionEntity();
                transaction.wallet_id = wallet.id;
                transaction.amount = signupBonus;
                transaction.type = WalletTxnType.CREDIT;
                transaction.status = WalletTxnStatus.SUCCESS;
                transaction.reference_type = WalletTxnReferenceType.SIGNUP_BONUS;
                transaction.reference_id = company ? company.company_unique_code : (global as any).crypto?.randomUUID ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();
                transaction.remarks = "free credit added by Q0";
                await transaction.save();

                await AuditLogService.log({
                    company_id: companyId,
                    member_id: memberId,
                    module: 'Wallet',
                    action: 'CREATE',
                    entity_type: 'WalletTransactionEntity',
                    entity_id: transaction.id,
                    entity_name: `Wallet-${wallet.id}`,
                    description: `Credits added with rupees (Signup Bonus: ${signupBonus})`,
                    ip_address: '',
                });
            }
        } catch (error) {
            console.error('Error initializing company wallet:', error);
            throw error;
        }
    }


    postProcessAfterGetById(result: any): Promise<CompanyModel> {
        return new Promise(async (resolve, reject) => {
            try {
                const companyRecord: CompanyEntity = result as any;
                if (companyRecord && companyRecord.id) {
                    const members = await this.companyMemberRolesService.getMembersForCompany(companyRecord.id);
                    (result as any).members = members;
                }
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }

    async findByCompanyEmail(companyEmail: string): Promise<CompanyEntity | null> {
        const result = await this.entity.findOneBy({ company_email: companyEmail });
        return result || null;
    }

    async findByCompanyUniqueId(companyUniqueId: string): Promise<CompanyEntity | null> {
        const result = await this.entity.findOneBy({ company_unique_id: companyUniqueId });
        return result || null;
    }

    async createCompany(companyData: any, memberRoleMapping?: { member_id: number; role_id: number; default_company?: boolean; active?: boolean }): Promise<CompanyEntity> {
        const defaultPlan = await PricePlanEntity.findOneBy({ is_default: true });
        companyData.price_plan_id = defaultPlan.id;
        const existingCompany = await this.entity.findOneBy({ company_name: companyData.company_name });
        if (existingCompany) {
            return Promise.reject('E10013');
        }
        const company = this.entity.create(companyData);
        company.company_unique_code = (global as any).crypto?.randomUUID ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();

        // Generate company_unique_id: Q0 + 4 random digits + space + company_name
        const random4Digits = Math.floor(1000 + Math.random() * 9000);
        company.company_unique_id = `Q0${random4Digits} ${companyData.company_name}`;

        if (memberRoleMapping && memberRoleMapping.member_id) {
            company.created_by = memberRoleMapping.member_id;
        }

        const savedCompany = await this.entity.save(company);
        const companyRecord: CompanyEntity = Array.isArray(savedCompany) ? savedCompany[0] : savedCompany;

        // Map default active roles to the new company
        const defaultRoles = await RolesEntity.find({ where: { active: true } });
        if (defaultRoles && defaultRoles.length > 0) {
            for (const role of defaultRoles) {
                const mapping = CompanyRoleMapperEntity.create({
                    company_id: companyRecord.id,
                    role_id: role.id,
                    active: true
                });
                await CompanyRoleMapperEntity.save(mapping);
            }
        }

        // Optionally create a member-company-role mapping if provided
        if (memberRoleMapping && memberRoleMapping.member_id && memberRoleMapping.role_id) {
            await this.companyMemberRolesService.assignMemberRole({
                company_id: companyRecord.id,
                member_id: memberRoleMapping.member_id,
                role_id: memberRoleMapping.role_id,
                default_company: memberRoleMapping.default_company ?? null,
                active: memberRoleMapping.active ?? true,
            });
        }

        // Initialize Wallet with Signup Bonus
        if (memberRoleMapping && memberRoleMapping.member_id) {
            await this.initializeCompanyWallet(companyRecord.id, memberRoleMapping.member_id, companyRecord.price_plan_id);
        }

        return companyRecord;
    }

    async updateCompanyName(companyId: number, newCompanyName: string, memberId?: number): Promise<void> {
        const company = await CompanyEntity.findOneBy({ id: companyId });
        const previousCompanyName = company?.company_name || 'Organisation';
        await CompanyEntity.update(companyId, { company_name: newCompanyName });

        await AuditLogService.log({
            company_id: companyId,
            member_id: memberId || null,
            module: this.getModuleName(),
            action: 'UPDATE',
            entity_type: 'CompanyEntity',
            entity_id: companyId,
            entity_name: previousCompanyName,
            description: `${previousCompanyName} has been updated to ${newCompanyName}`,
            ip_address: '',
        });
    }

    async prepareQuery(param: any): Promise<any> {
        try {
            const memberId = param.decryptToken.member_id;
            if (!memberId) {
                return [];
            }
            let whereCondition = ''
            let Pagination = ''
            if (param.search_text) {
                whereCondition = `AND c.company_name ILIKE '%${param.search_text}%'`
            }
            if (param.page && param.limit) {
                Pagination = `LIMIT ${param.limit} OFFSET ${(param.page - 1) * param.limit}`
            }
            const query = `
                SELECT DISTINCT ON (c.id)
                    c.id,
                    my_cmr.is_access_active,
                    c.company_name,
                    c.is_kyc,
                    my_cmr.default_company,
                    c.company_unique_id,
                    c.created_at,
                    c.created_by,
                    my_cmr.role_id,
                    r.name as role_name,
                    creator.full_name as creator_name,
                    creator.profile_picture as creator_image,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'profile_picture', u.profile_picture,
                                'full_name', u.full_name,
                                'id', u.id
                            )
                        )
                        FROM (
                            SELECT DISTINCT ON (m.id)
                                m.id,
                                m.full_name,
                                m.profile_picture
                            FROM v0_dev_yotta.company_member_roles cmr
                            JOIN v0_dev_yotta.members m ON cmr.member_id = m.id
                            WHERE cmr.company_id = c.id AND cmr.active = true AND m.is_delete = 0 AND cmr.is_delete = 0
                            ORDER BY m.id
                            LIMIT 5
                        ) u
                    ) AS users
                FROM v0_dev_yotta.company c
                JOIN v0_dev_yotta.company_member_roles my_cmr ON c.id = my_cmr.company_id AND my_cmr.is_delete = 0
                JOIN v0_dev_yotta.roles r ON my_cmr.role_id = r.id AND r.active = true
                LEFT JOIN v0_dev_yotta.members creator ON c.created_by = creator.id AND creator.is_delete = 0
                WHERE my_cmr.member_id = $1 AND my_cmr.active = true AND c.is_delete = 0 
                ${whereCondition}
                ORDER BY c.id DESC
                ${Pagination}
            `;

            const dbConnection = Database.getInstance();
            const result = await dbConnection.executeExternalQuery(query, [memberId]);
            for (const record of result) {
                const creatorProfilePic = record.creator_image;
                if (!creatorProfilePic || creatorProfilePic.trim() === "") {
                    record.creator_image = null;
                    record.creator_image_signed_url = null;
                } else if (creatorProfilePic.startsWith("http://") || creatorProfilePic.startsWith("https://")) {
                    record.creator_image = creatorProfilePic;
                    record.creator_image_signed_url = creatorProfilePic;
                } else {
                    const signedUrl = await this.generateSignedUrl(
                        'members',
                        record.created_by,
                        creatorProfilePic
                    );
                    record.creator_image = creatorProfilePic;
                    record.creator_image_signed_url = signedUrl;
                }
                if (Array.isArray(record.users)) {
                    for (const user of record.users) {

                        const profilePic = user.profile_picture;

                        if (!profilePic || profilePic.trim() === "") {
                            user.profile_picture = null;
                            user.signed_url_profile_picture = null;

                        } else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                            user.profile_picture = profilePic;
                            user.signed_url_profile_picture = profilePic;

                        } else {
                            const signedUrl = await this.generateSignedUrl(
                                'members',
                                user.id,
                                profilePic
                            );
                            user.profile_picture = profilePic;
                            user.signed_url_profile_picture = signedUrl;
                        }
                    }
                }
            }

            return result;

        } catch (error) {
            console.error('Error fetching organizations:', error);
            throw error;
        }
    }

    override updateDeleteFlagData = (param: any): Promise<boolean> => {
        return new Promise(async (resolve, reject) => {
            try {
                const member_id = param.decryptToken.member_id;
                const totalCompany = await this.entity.find({
                    where: { created_by: member_id, is_delete: 0 }
                });

                if (totalCompany.length > 1) {
                    const whereid = await this.updateDeleteFlagPreProcess(param);

                    if (!whereid) {
                        return resolve(false);
                    }

                    const record = await this.entity.find({
                        where: { id: whereid, is_delete: 0 }
                    });

                    if (record && record.length > 0) {
                        await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();
                        return resolve(true);
                    } else {
                        return resolve(false);
                    }
                } else {
                    return reject(`E10049`)
                }
            } catch (error) {
                return reject(error);
            }
        });
    };
}

export default CompanyService;
