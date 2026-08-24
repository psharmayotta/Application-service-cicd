import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { In } from 'typeorm';
import { KAFKAPRODUCERS, ModuleType, DEV_URL, FRONTENDDOMAIN } from '../../config';
import { AwsService } from '../../core/AwsService';
import Database from '../../database/database';
import { InviteDto } from '../../database/repository/invite/invite.dto';
import { InviteModel } from '../../database/repository/invite/invite.model';
import { CompanyEntity } from '../../entities/companyEntity';
import { CompanyMemberRolesEntity } from '../../entities/companyMemberRolesEntity';
import { InviteEntity } from '../../entities/inviteEntity';
import { MembersEntity } from '../../entities/membersEntity';
import { RolesEntity } from '../../entities/rolesEntity';
import { KafkaService } from '../../utils/kafka/KafkaService';
import APIKeyTokenService from '../apiKeyToken/apiKeyTokenService.services';
import { BaseServices } from '../baseService.services';
import { InferParams } from '../../core/InferParams';
import AuditLogService from '../auditLog/auditLogService.services';
import WebhookService from '../webhook/webhookService.services';


const INVITE_RESPOND_PATH = '/invite/respond';

class InviteService extends BaseServices {
    constructor(entity: any = InviteEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InviteModel {
        return new InviteModel();
    }
    getDTO(): any {
        return InviteDto;
    }

    getModuleName(): string {
        return 'Invite';
    }

    override async createRecord(model: any, files: any | null): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const createdInvites: any[] = [];
            const emails = Array.isArray(model.email) ? model.email : [model.email];
            const createdBy = model.decryptToken ? model.decryptToken.member_id : 0;
            for (const email of emails) {
                const inviteRecord = await this.entity.findOneBy({ email: email, company_unique_code: model.company_unique_code, is_delete: 0 });
                if (inviteRecord) {
                    return reject('E10058');
                }
                const payload: InviteModel = {
                    ...model,
                    email: email,
                    created_by: createdBy,
                    invite_token: uuidv4(),
                    status: model.status || 'pending'
                };
                const savedInvite = await super.createRecord(payload, files);
                createdInvites.push(savedInvite);
                const member = await MembersEntity.findOneBy({ email: email, is_delete: 0 });
                if (model.id === undefined || model.id === null) {
                    await this.sentInviteEmail(payload, email, member);

                    const companyInfo = await CompanyEntity.findOneBy({ company_unique_id: model.company_unique_code, is_delete: 0 });

                    try {
                        const webhookService = new WebhookService();
                        const inviter = await MembersEntity.findOneBy({ id: model.decryptToken?.member_id, is_delete: 0 });
                        webhookService.dispatchTemplatedAlert(companyInfo?.id || model.company_id, 'Invite', 'SENT', {
                            invitee: email,
                            userName: inviter?.full_name || '',
                            workspace: (companyInfo as any)?.company_name || '',
                        }).catch(webhookErr => {
                            console.error('Error sending MEMBER_INVITED webhook:', webhookErr);
                        });
                    } catch (webhookErr) {
                        console.error('Error initiating MEMBER_INVITED webhook:', webhookErr);
                    }

                    await AuditLogService.log({
                        company_id: companyInfo?.id || model.company_id,
                        member_id: createdBy,
                        module: this.getModuleName(),
                        action: 'SHARED INVITE',
                        entity_type: 'InviteEntity',
                        entity_id: savedInvite.id,
                        entity_name: email,
                        description: `Invitation sent to ${email}`,
                        ip_address: '',
                    });
                }
            }
            resolve(createdInvites);
        });
    }

    private async sentInviteEmail(payload: InviteModel, email: any, member: MembersEntity) {
        const baseLink = `${FRONTENDDOMAIN}${INVITE_RESPOND_PATH}?code=${payload.invite_token}`;
        const request = {
            to: email,
            emailcode: 'ORG_JOIN_REQUEST',
            variables: {
                VERIFICATION_LINK: `${baseLink}&action=accept`,
                ACCEPT_LINK: `${baseLink}&action=accept`,
                REJECT_LINK: `${baseLink}&action=reject`,
                NAME: member?.full_name || email,
                ROLE_NAME: '',
                WORKSPACE_NAMES: '',
            }
        };
        const kafkaMessage = {
            module: ModuleType.EMAIL,
            request
        };
        const kafkaService = KafkaService.getInstance();
        await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
    }

    async validateInviteCode(model: any): Promise<any> {
        const email = Array.isArray(model?.email) ? model.email[0] : model?.email;
        const inviteToken = (model?.invite_token || '').trim();

        if (!inviteToken) {
            return Promise.reject('E10005');
        }

        const invites = await this.entity.find({ where: { invite_token: inviteToken, is_delete: 0 } });
        if (!invites.length) {
            return Promise.reject('E10018');
        }

        // The token must belong to the signed-in user that is redeeming it.
        if (email && String(invites[0].email).toLowerCase() !== String(email).toLowerCase()) {
            return Promise.reject('E10018');
        }

        const result = await this.respondToInvite({ invite_token: inviteToken, action: 'accept' });
        const [firstWorkspace] = result.workspaces || [];

        // Response shape kept backward compatible with the post-login redemption flow,
        // which reads company_id / company_name off the payload.
        return {
            ...result,
            company_id: firstWorkspace?.company_id ?? null,
            company_name: firstWorkspace?.company_name ?? null,
        };
    }

    async resendInvite(model: InviteModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const invite = await InviteEntity.findOneBy({ id: model.id, is_delete: 0 });
                if (!invite) {
                    reject(`E10018`);
                }
                const member = await MembersEntity.findOneBy({ email: invite.email, is_delete: 0 });
                if (!member) {
                    reject(`E10018`);
                }

                const inviteLink = `${FRONTENDDOMAIN}${INVITE_RESPOND_PATH}?code=${invite.invite_token}&action=accept`;
                const request = {
                    to: invite.email,
                    emailcode: 'ORG_JOIN_REQUEST',
                    variables: {
                        VERIFICATION_LINK: inviteLink,
                        ACCEPT_LINK: inviteLink,
                        REJECT_LINK: `${FRONTENDDOMAIN}${INVITE_RESPOND_PATH}?code=${invite.invite_token}&action=reject`,
                        NAME: member.full_name,
                        ROLE_NAME: '',
                        WORKSPACE_NAMES: '',
                    }
                };
                const kafkaMessage = {
                    module: ModuleType.EMAIL,
                    request
                }
                const kafkaService = KafkaService.getInstance();
                await kafkaService.sendMessage(KAFKAPRODUCERS.EMAIL, kafkaMessage);
                const updatestatus = await this.entity.update(
                    { id: invite.id },
                    { status: 'pending' }
                );
                resolve({ invite_code: invite.invite_token });
            } catch (error) {
                reject(error);
            }
        });
    }

    async getInviteLink(model: InviteModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const invite = await InviteEntity.findOneBy({ id: model.id, is_delete: 0 });

                if (!invite) {
                    reject(`E10018`);
                }

                const inviteLink = `${FRONTENDDOMAIN}${INVITE_RESPOND_PATH}?code=${invite.invite_token}&action=accept`;
                resolve({ invite_link: inviteLink });
            } catch (error) {
                reject(error);
            }
        });
    }

    async cancelInvite(model: InviteModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const invite = await InviteEntity.findOneBy({ id: model.id, is_delete: 0 });

                if (!invite) {
                    reject(`E10018`);
                }

                const cancelInvite = await InviteEntity.update({ id: invite.id }, { status: 'cancelled' });
                resolve({ message: 'Invite cancelled successfully' });
            } catch (error) {
                reject(error);
            }
        });
    }

    public override updateDeleteFlagData = async (param: InferParams): Promise<boolean> => {
        try {
            const inviteId = await this.updateDeleteFlagPreProcess(param);
            if (!inviteId) return false;

            const invite = await this.entity.findOne({
                where: { id: inviteId, is_delete: 0 },
            });

            if (!invite) return false;

            const { company_unique_code, email } = invite;

            if (!company_unique_code || !email) return false;

            const company = await CompanyEntity.findOne({
                where: { company_unique_id: company_unique_code, is_delete: 0 },
            });

            if (!company) return false;

            const member = await MembersEntity.findOne({
                where: { email: email, is_delete: 0 },
            });

            let roleRecord = null;
            if (member) {
                roleRecord = await CompanyMemberRolesEntity.findOne({
                    where: {
                        company_id: company.id,
                        member_id: member.id,
                        is_delete: 0,
                    },
                });
            }

            if (roleRecord) {
                await CompanyMemberRolesEntity.createQueryBuilder()
                    .update(CompanyMemberRolesEntity)
                    .set({ is_delete: 1 })
                    .where({ id: roleRecord.id })
                    .execute();
            }

            await this.entity.createQueryBuilder()
                .update(this.entity)
                .set({ is_delete: 1 })
                .where({ id: inviteId })
                .execute();

            return true;
        } catch (error) {
            throw error;
        }
    };

    async multiWorkspaceInvite(payload: {
        email: string[];
        role_id: number;
        workspace_ids: number[];
        firstName?: string;
        lastName?: string;
        mobileNo?: string;
        decryptToken?: any;
        authToken?: string;
    }): Promise<any> {
        const { email: emails, role_id, workspace_ids, firstName, lastName, mobileNo, decryptToken, authToken } = payload;
        const createdBy = decryptToken?.member_id || 0;

        const companies = await CompanyEntity.find({ where: { id: In(workspace_ids), is_delete: 0 } });
        if (companies.length === 0) {
            return Promise.reject('E10021');
        }

        const roleName = await this.resolveRoleName(role_id);
        const results: any[] = [];

        for (const emailRaw of emails) {
            const email = (emailRaw || '').trim().toLowerCase();
            if (!email) continue;

            const member = await MembersEntity.findOne({ where: { email, is_delete: 0 } });
            const isNewUser = !member;

            if (isNewUser) {
                try {
                    const emailLocal = email.split('@')[0];
                    const resolvedFirst = firstName || emailLocal;
                    const resolvedLast = lastName || firstName || emailLocal;
                    await axios.post(`${DEV_URL}/util/api/yotta-user/create-external`, {
                        firstName: resolvedFirst,
                        lastName: resolvedLast,
                        email,
                        mobileNo: mobileNo || '91-0000000000',
                        userType: role_id === 1 ? 'Admin' : role_id === 3 ? 'Commercial' : 'Technology',
                        accountCRMUUID: companies[0]?.metadata?.id || companies[0]?.metadata?.account_number__c?.toString() || '',
                    }, {
                        headers: {
                            Authorization: authToken ? `Bearer ${authToken}` : '',
                            'Content-Type': 'application/json',
                        },
                        timeout: 30000,
                    });
                } catch (extErr: any) {
                    console.error(`[MultiInvite] OneYotta user creation failed for ${email}:`, extErr?.response?.data || extErr?.message);
                }
            }

            // A single token covers every workspace in this batch so one accept/reject
            // action (and one email) applies to all of them.
            const inviteToken = uuidv4();
            const invitedWorkspaceNames: string[] = [];

            for (const company of companies) {
                try {
                    const existingInvite = await this.entity.findOneBy({
                        email,
                        company_unique_code: company.company_unique_id,
                        is_delete: 0,
                    });

                    if (existingInvite?.status === 'active') {
                        results.push({ email, workspace_id: company.id, status: 'already_member' });
                        continue;
                    }

                    if (existingInvite) {
                        await this.entity.update(
                            { id: existingInvite.id },
                            { invite_token: inviteToken, status: 'pending', role_id, created_by: company.created_by || createdBy }
                        );
                        invitedWorkspaceNames.push((company as any).company_name);
                        results.push({ email, workspace_id: company.id, invite_id: existingInvite.id, status: 'invite_renewed' });
                        continue;
                    }

                    const savedInvite = await InviteEntity.save(
                        InviteEntity.create({
                            company_unique_code: company.company_unique_id,
                            email,
                            invite_token: inviteToken,
                            status: 'pending',
                            role_id,
                            created_by: company.created_by || createdBy,
                            company_member_role_id: 0,
                        })
                    );
                    invitedWorkspaceNames.push((company as any).company_name);
                    results.push({ email, workspace_id: company.id, invite_id: savedInvite.id, status: 'invite_created' });
                } catch (wsErr: any) {
                    console.error(`[MultiInvite] Error inviting ${email} to workspace ${company.id}:`, wsErr);
                    results.push({ email, workspace_id: company.id, status: 'failed', error: wsErr?.message || wsErr });
                }
            }

            // Exactly one email per invitee, covering every workspace of this batch.
            // New users are onboarded by OneYotta and get their credentials from there.
            if (!isNewUser && invitedWorkspaceNames.length > 0) {
                await this.sendInviteDecisionEmail({
                    email,
                    name: member?.full_name || email,
                    inviteToken,
                    workspaceNames: invitedWorkspaceNames,
                    roleName,
                });
            }
        }

        return results;
    }

    private async sendInviteDecisionEmail(params: {
        email: string;
        name: string;
        inviteToken: string;
        workspaceNames: string[];
        roleName: string;
    }): Promise<void> {
        const { email, name, inviteToken, workspaceNames, roleName } = params;
        const baseLink = `${FRONTENDDOMAIN}${INVITE_RESPOND_PATH}?code=${inviteToken}`;

        const request = {
            to: email,
            emailcode: 'ORG_JOIN_REQUEST',
            variables: {
                NAME: name,
                ROLE_NAME: roleName,
                WORKSPACE_NAMES: workspaceNames.join(', '),
                WORKSPACE_COUNT: workspaceNames.length,
                ACCEPT_LINK: `${baseLink}&action=accept`,
                REJECT_LINK: `${baseLink}&action=reject`,
                // Retained so already-published templates keep working.
                VERIFICATION_LINK: `${baseLink}&action=accept`,
            },
        };

        await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.EMAIL, { module: ModuleType.EMAIL, request });
    }

    /**
     * Read-only lookup used by the invite landing page. Safe to call from an
     * unauthenticated context and safe against email link pre-fetching because it
     * never mutates state.
     */
    async getInviteDetails(model: any): Promise<any> {
        const inviteToken = (model?.invite_token || '').trim();
        if (!inviteToken) {
            return Promise.reject('E10005');
        }

        const invites = await this.entity.find({ where: { invite_token: inviteToken, is_delete: 0 } });
        if (!invites.length) {
            return Promise.reject('E10018');
        }

        const companyCodes = invites.map((invite: InviteEntity) => invite.company_unique_code);
        const companies = await CompanyEntity.find({
            where: { company_unique_id: In(companyCodes), is_delete: 0 },
        });
        const companyByCode = new Map(
            companies.map((company) => [company.company_unique_id, company])
        );

        const [firstInvite] = invites;
        const member = await MembersEntity.findOne({ where: { email: firstInvite.email, is_delete: 0 } });
        const inviter = firstInvite.created_by
            ? await MembersEntity.findOne({ where: { id: firstInvite.created_by, is_delete: 0 } })
            : null;

        return {
            email: firstInvite.email,
            invite_token: inviteToken,
            role_id: firstInvite.role_id,
            role_name: await this.resolveRoleName(firstInvite.role_id),
            status: this.deriveBatchStatus(invites),
            user_exists: !!member,
            invited_by: inviter?.full_name || null,
            invited_at: firstInvite.created_at,
            workspaces: invites.map((invite: InviteEntity) => {
                const company = companyByCode.get(invite.company_unique_code);
                return {
                    invite_id: invite.id,
                    company_id: company?.id || null,
                    company_name: (company as any)?.company_name || invite.company_unique_code,
                    status: invite.status,
                };
            }),
        };
    }

    /**
     * Applies an accept/reject decision to every invite that shares the token, so a
     * multi-workspace invitation is resolved by a single user action. Idempotent:
     * replaying the same decision returns the already-applied state instead of failing.
     */
    async respondToInvite(model: any): Promise<any> {
        const inviteToken = (model?.invite_token || '').trim();
        const action = (model?.action || '').trim().toLowerCase();

        if (!inviteToken || !['accept', 'reject'].includes(action)) {
            return Promise.reject('E10005');
        }

        const invites = await this.entity.find({ where: { invite_token: inviteToken, is_delete: 0 } });
        if (!invites.length) {
            return Promise.reject('E10018');
        }

        const [firstInvite] = invites;
        const member = await MembersEntity.findOne({ where: { email: firstInvite.email, is_delete: 0 } });

        if (action === 'reject') {
            const openInvites = invites.filter((invite: InviteEntity) => invite.status === 'pending');
            if (openInvites.length) {
                await this.entity.update(
                    { id: In(openInvites.map((invite: InviteEntity) => invite.id)) },
                    { status: 'cancelled' }
                );
            }
            return {
                action: 'reject',
                email: firstInvite.email,
                processed: openInvites.length,
                status: 'cancelled',
            };
        }

        if (!member) {
            // The invitee has no Q0 account yet; the UI must route them through signup
            // first so the membership binds to a real member row.
            return Promise.reject('E10047');
        }

        const companyCodes = invites.map((invite: InviteEntity) => invite.company_unique_code);
        const companies = await CompanyEntity.find({
            where: { company_unique_id: In(companyCodes), is_delete: 0 },
        });
        const companyByCode = new Map(
            companies.map((company) => [company.company_unique_id, company])
        );

        const joined: Array<{ company_id: number; company_name: string }> = [];

        for (const invite of invites) {
            const company = companyByCode.get(invite.company_unique_code);
            if (!company) continue;

            let mapping = await CompanyMemberRolesEntity.findOne({
                where: { company_id: company.id, member_id: member.id, is_delete: 0 },
            });

            if (mapping) {
                if (!mapping.active) {
                    mapping.active = true;
                    await mapping.save();
                }
                if (mapping.role_id !== invite.role_id) {
                    mapping.role_id = invite.role_id;
                    await mapping.save();
                }
            } else {
                mapping = await CompanyMemberRolesEntity.save(
                    CompanyMemberRolesEntity.create({
                        company_id: company.id,
                        member_id: member.id,
                        role_id: invite.role_id,
                        default_company: false,
                        active: true,
                    })
                );
            }

            if (invite.status !== 'active') {
                await this.entity.update(
                    { id: invite.id },
                    { status: 'active', company_member_role_id: mapping.id }
                );
            }

            joined.push({ company_id: company.id, company_name: (company as any).company_name });

            try {
                new WebhookService().dispatchTemplatedAlert(company.id, 'Invite', 'ACCEPTED', {
                    invitee: invite.email,
                    userName: '',
                    workspace: (company as any).company_name || '',
                }).catch((webhookErr) => {
                    console.error('Error sending INVITATION_ACCEPTED webhook:', webhookErr);
                });
            } catch (webhookErr) {
                console.error('Error sending INVITATION_ACCEPTED webhook:', webhookErr);
            }

            await AuditLogService.log({
                company_id: company.id,
                member_id: member.id,
                module: this.getModuleName(),
                action: 'ACCEPTED INVITE',
                entity_type: 'InviteEntity',
                entity_id: invite.id,
                entity_name: invite.email,
                description: `${invite.email} accepted the invitation to join ${(company as any).company_name}`,
                ip_address: '',
            });
        }

        try {
            new APIKeyTokenService().createInitialApiKeyToken(member.id);
        } catch (tokenErr) {
            console.error('[InviteRespond] createInitialApiKeyToken failed:', tokenErr);
        }

        return {
            action: 'accept',
            email: firstInvite.email,
            processed: joined.length,
            status: 'active',
            workspaces: joined,
        };
    }

    private deriveBatchStatus(invites: InviteEntity[]): string {
        if (invites.some((invite) => invite.status === 'pending')) return 'pending';
        if (invites.some((invite) => invite.status === 'active')) return 'active';
        return invites[0]?.status || 'cancelled';
    }

    private async resolveRoleName(roleId: number): Promise<string> {
        try {
            const rows = await Database.getInstance().executeExternalQuery(
                `SELECT role_name FROM v0_dev_admin_yotta.rbac_roles WHERE id = $1 AND is_delete = 0 LIMIT 1`,
                [roleId]
            );
            if (rows?.length) return rows[0].role_name;

            const legacyRole = await RolesEntity.findOne({ where: { id: roleId } });
            return legacyRole?.name || 'Member';
        } catch (error) {
            console.error('[MultiInvite] resolveRoleName failed:', error);
            return 'Member';
        }
    }
}

export default InviteService;
