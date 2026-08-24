import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { CompanyEntity } from "../../entities/companyEntity";
import { In } from "typeorm";
import { MembersEntity } from "../../entities/membersEntity";
import { RolesEntity } from "../../entities/rolesEntity";
import { CompanyMemberRolesModel } from "../../database/repository/companyMemberRoles/companyMemberRoles.model";
import { CompanyMemberRolesDto } from "../../database/repository/companyMemberRoles/companyMemberRoles.dto";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { KAFKAPRODUCERS, ModuleType, FRONTENDDOMAIN } from "../../config";
import { InviteEntity } from "../../entities/inviteEntity";
import AuditLogService from "../auditLog/auditLogService.services";

class CompanyMemberRolesService extends BaseServices {
    constructor(entity: any = CompanyMemberRolesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }
    getModel(): any {
        return new CompanyMemberRolesModel();
    }
    getDTO(): any {
        return CompanyMemberRolesDto;
    }



    async assignMemberRole(params: { company_id: number | null; member_id: number; role_id: number; default_company?: boolean; active?: boolean }): Promise<CompanyMemberRolesEntity> {
        const record = this.entity.create({
            company_id: params.company_id ?? null,
            member_id: params.member_id,
            role_id: params.role_id,
            default_company: params.default_company ?? null,
            active: params.active ?? true,
        });
        await this.entity.save(record);
        
        if (params.company_id) {
            await AuditLogService.log({
                company_id: params.company_id,
                member_id: params.member_id,
                module: this.getModuleName(),
                action: 'CREATE',
                entity_type: 'CompanyMemberRolesEntity',
                entity_id: record.id,
                entity_name: `CompanyMemberRole-${record.id}`,
                description: `Added existing organization`,
                ip_address: '',
            });
        }
        
        return record;
    }

    async getCompaniesForMember(memberId: number): Promise<Array<{ id: number; company_name: string; company_email: string; is_active: boolean; default_company: boolean | null; role_id: number | null }>> {
        const mappings: CompanyMemberRolesEntity[] = await CompanyMemberRolesEntity.find({ where: { member_id: memberId, active: true, is_delete: 0 } });
        const companyIds: number[] = mappings
            .map((mapping) => mapping.company_id)
            .filter((id): id is number => id !== null && id !== undefined);

        if (companyIds.length === 0) {
            return [];
        }

        const companies = await CompanyEntity.find({
            where: {
                id: In(companyIds),
                is_delete: 0
            }
        });


        const companyIdToMapping = new Map<number, CompanyMemberRolesEntity>();
        for (const mapping of mappings) {
            if (mapping.company_id != null) {
                companyIdToMapping.set(mapping.company_id, mapping);
            }
        }

        return companies.map((company) => {
            const mapping = companyIdToMapping.get(company.id);
            return {
                id: company.id,
                company_name: (company as any).company_name,
                company_email: (company as any).company_email,
                is_active: (company as any).is_active,
                is_kyc: (company as any).is_kyc,
                default_company: mapping ? mapping.default_company : null,
                role_id: mapping ? mapping.role_id : null,
            };
        });
    }

    async getMembersForCompany(companyId: number): Promise<Array<{ id: number; full_name: string; email: string; role_id: number | null; default_company: boolean | null; active: boolean | null }>> {
        const mappings: CompanyMemberRolesEntity[] = await CompanyMemberRolesEntity.find({ where: { company_id: companyId, active: true } });
        const memberIds: number[] = mappings
            .map((mapping) => mapping.member_id)
            .filter((id): id is number => id !== null && id !== undefined);

        if (memberIds.length === 0) {
            return [];
        }

        const members = await MembersEntity.findBy({ id: In(memberIds) });

        const memberIdToMapping = new Map<number, CompanyMemberRolesEntity>();
        for (const mapping of mappings) {
            if (mapping.member_id != null) {
                memberIdToMapping.set(mapping.member_id, mapping);
            }
        }

        return members.map((member) => {
            const mapping = memberIdToMapping.get(member.id);
            return {
                id: member.id,
                full_name: (member as any).full_name,
                email: (member as any).email,
                role_id: mapping ? mapping.role_id : null,
                default_company: mapping ? mapping.default_company : null,
                active: mapping ? mapping.active : null,
                joined_at: mapping ? mapping.created_at : null,
            };
        });
    }
    async updateDeleteFlagPreProcess(param: any): Promise<any> {
        try {
            const memberId = param.decryptToken.member_id;
            const companyId = param.company_id;

            if (!memberId || !companyId) {
                return Promise.reject("E10005"); // Bad Request if missing IDs
            }

            const record = await this.entity.findOne({
                where: {
                    member_id: memberId,
                    company_id: companyId,
                    is_delete: 0
                }
            });
            console.log(record, "_______________________________record_________________________-")

            if (!record) {
                return Promise.reject("E10021"); // Record not found
            }

            const adminRole = await this.getAdminRole();
            if (adminRole && record.role_id === adminRole.id) {
                return Promise.reject("E10053");
            }
            await InviteEntity.update({ company_member_role_id: record.id }, { is_delete: 1 });
            return Promise.resolve(In([record.id]));
        } catch (error) {
            return Promise.reject(error);
        }
    }

    protected async getAdminRole(): Promise<RolesEntity | null> {
        return await RolesEntity.findOne({ where: { name: 'ADMIN' } });
    }

    async getCompanyAdminEmails(companyId: number): Promise<string[]> {
        const admins = await this.getCompanyAdmins(companyId);
        return admins.map(m => m.email);
    }

    async getCompanyAdmins(companyId: number): Promise<MembersEntity[]> {
        const adminRole = await this.getAdminRole();
        if (!adminRole) return [];

        const adminRoles = await this.entity.find({
            where: {
                company_id: companyId,
                role_id: adminRole.id,
                active: true
            }
        });

        if (adminRoles.length === 0) return [];

        const memberIds = adminRoles.map(ar => ar.member_id).filter(id => id !== null) as number[];
        return await MembersEntity.find({
            where: {
                id: In(memberIds)
            }
        });
    }

    async approveMember(adminMemberId: number, targetMemberId: number, companyId: number): Promise<void> {
        // 1. Verify Admin
        const adminRole = await this.getAdminRole();
        if (!adminRole) throw new Error('Admin role not found');

        const isAdmin = await this.entity.findOne({
            where: {
                member_id: adminMemberId,
                company_id: companyId,
                role_id: adminRole.id,
                active: true
            }
        });

        if (!isAdmin) {
            return Promise.reject('E10056');
        }

        // 2. Find Pending Request
        const pendingRecord = await this.entity.findOne({
            where: {
                member_id: targetMemberId,
                company_id: companyId,
                active: false
            }
        });

        if (!pendingRecord) {
            return Promise.reject('E10055');
        }

        // 3. Approve
        pendingRecord.active = true;
        await this.entity.save(pendingRecord);

        // 4. Notify User
        const member = await MembersEntity.findOne({ where: { id: targetMemberId } });
        const company = await CompanyEntity.findOne({ where: { id: companyId } });

        if (member && company) {
            // Set profile_complete to true to allow login
            member.profile_complete = true;
            await MembersEntity.save(member);

            const request = {
                to: member.email,
                emailcode: 'APPROVED_MEMBER',
                variables: {
                    USER_NAME: member.full_name,
                    COMPANY_NAME: (company as any).company_name,
                    VERIFICATION_LINK: FRONTENDDOMAIN
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

    async rejectMember(adminMemberId: number, targetMemberId: number, companyId: number): Promise<void> {
        // 1. Verify Admin
        const adminRole = await this.getAdminRole();
        if (!adminRole) throw new Error('Admin role not found');

        const isAdmin = await this.entity.findOne({
            where: {
                member_id: adminMemberId,
                company_id: companyId,
                role_id: adminRole.id,
                active: true
            }
        });

        if (!isAdmin) {
            return Promise.reject('E10056');
        }

        // 2. Find Pending Request
        const pendingRecord = await this.entity.findOne({
            where: {
                member_id: targetMemberId,
                company_id: companyId,
                active: false
            }
        });

        if (!pendingRecord) {
            return Promise.reject('E10055');
        }

        // 3. Reject (Delete)
        await this.entity.remove(pendingRecord);

        // 4. Notify User
        const member = await MembersEntity.findOne({ where: { id: targetMemberId } });
        const company = await CompanyEntity.findOne({ where: { id: companyId } });

        if (member && company) {
            const request = {
                to: member.email,
                emailcode: 'MEMBER_REJECTED',
                variables: {
                    MEMBER_NAME: member.full_name,
                    COMPANY_NAME: (company as any).company_name
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

    async deActivate(model: CompanyMemberRolesModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const record = await this.entity.findOneBy({ company_id: model.company_id, member_id: model.member_id, is_delete: 0 });

                if (!record) {
                    reject(`E10047`);
                }
                record.is_access_active = false;
                await this.entity.save(record);
                if (model.invite_id) {
                    await InviteEntity.createQueryBuilder()
                        .update(InviteEntity)
                        .set({ status: 'cancelled' })
                        .where({ id: model.invite_id })
                        .execute();
                }
                resolve('Member deactivated successfully');
            } catch (error) {
                reject(error);
            }
        });
    }

}

export default CompanyMemberRolesService;


