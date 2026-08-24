import { Between, In, ILike } from 'typeorm';
import { AwsService } from '../../core/AwsService';
import { Pagination } from '../../core/InferParams';
import { BaseServices } from '../baseService.services';
import { AuditLogEntity } from '../../entities/auditLogEntity';
import { AuditLogModuleEntity } from '../../entities/auditLogModuleEntity';
import { AuditLogActionEntity } from '../../entities/auditLogActionEntity';
import { AuditLogModel } from '../../database/repository/auditLog/auditLog.model';
import { AuditLogDto } from '../../database/repository/auditLog/auditLog.dto';
import { MembersEntity } from '../../entities/membersEntity';
import { CompanyMemberRolesEntity } from '../../entities/companyMemberRolesEntity';

class AuditLogService extends BaseServices {
    constructor(entity: any = AuditLogEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): AuditLogModel {
        return new AuditLogModel();
    }

    getDTO(): any {
        return AuditLogDto;
    }

    getModuleName(): string {
        return 'Audit Log';
    }

    private resolveCreatedAtRange(filters: any): { start: Date; end: Date } | null {
        const selectedRange = filters.date_range ?? filters.dateRange ?? filters.preset_filter;
        if (!selectedRange) return null;
        if (typeof selectedRange !== 'string') throw 'E10004';

        const normalizedRange = selectedRange.trim().toLowerCase().replace(/[\s_-]+/g, '');
        const now = new Date();
        const presetDurations: Record<string, number> = {
            last12hours: 12 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            last24hours: 24 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            last1week: 7 * 24 * 60 * 60 * 1000,
            '1w': 7 * 24 * 60 * 60 * 1000,
            last1month: 30 * 24 * 60 * 60 * 1000,
            '1m': 30 * 24 * 60 * 60 * 1000,
        };

        if (normalizedRange === 'custom') {
            const startValue = filters.start_date ?? filters.startDate;
            const endValue = filters.end_date ?? filters.endDate;
            if (!startValue || !endValue) throw 'E10021';

            const start = new Date(startValue);
            const end = new Date(endValue);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
                throw 'E10004';
            }

            return { start, end };
        }

        const duration = presetDurations[normalizedRange];
        if (!duration) throw 'E10004';

        return {
            start: new Date(now.getTime() - duration),
            end: now,
        };
    }

    private static moduleCache: Record<string, number> = {};
    private static actionCache: Record<string, number> = {};

    private static normalizeFailureReason(reason: any): string | null {
        if (reason === null || reason === undefined) return null;

        let value: string | null = null;

        if (typeof reason === 'string') {
            value = reason;
        } else if (reason instanceof Error) {
            value = reason.message || String(reason);
        } else if (typeof reason === 'object') {
            try {
                value = JSON.stringify(reason);
            } catch {
                value = String(reason);
            }
        } else {
            value = String(reason);
        }

        const cleaned = value?.replace(/\s+/g, ' ').trim();
        if (!cleaned) return null;

        return cleaned.length > 1000 ? `${cleaned.slice(0, 997)}...` : cleaned;
    }

    static extractFailureReason(...candidates: any[]): string | null {
        const reasonKeys = [
            'failure_reason',
            'failureMessage',
            'error_message',
            'errorMessage',
            'reason',
            'details',
            'detail',
            'message',
            'error',
            'logs',
            'log',
        ];

        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined) continue;

            if (typeof candidate === 'string' || candidate instanceof Error) {
                const normalized = this.normalizeFailureReason(candidate);
                if (normalized) return normalized;
                continue;
            }

            if (typeof candidate === 'object') {
                if (Array.isArray(candidate)) {
                    const arrayReason = this.extractFailureReason(...candidate);
                    if (arrayReason) return arrayReason;
                    continue;
                }

                for (const key of reasonKeys) {
                    if ((candidate as any)[key] !== undefined && (candidate as any)[key] !== null) {
                        const nested = this.extractFailureReason((candidate as any)[key]);
                        if (nested) return nested;
                    }
                }

                continue;
            }

            const normalized = this.normalizeFailureReason(candidate);
            if (normalized) return normalized;
        }

        return null;
    }

    private static async getModuleId(name: string): Promise<number> {
        const key = name.toUpperCase();
        if (this.moduleCache[key]) return this.moduleCache[key];
        let mod = await AuditLogModuleEntity.findOne({ where: { name: key } });
        if (!mod) {
            mod = await AuditLogModuleEntity.save({ name: key });
        }
        this.moduleCache[key] = mod.id;
        return mod.id;
    }

    private static async getActionId(name: string): Promise<number> {
        const key = name.toUpperCase();
        if (this.actionCache[key]) return this.actionCache[key];
        let act = await AuditLogActionEntity.findOne({ where: { name: key } });
        if (!act) {
            act = await AuditLogActionEntity.save({ name: key });
        }
        this.actionCache[key] = act.id;
        return act.id;
    }

    /**
     * Static method to log an audit event from any service.
     * Fire-and-forget — errors are caught silently to avoid disrupting main flow.
     */
    static async log(params: {
        company_id: number;
        member_id: number;
        module: string;
        action: string;
        entity_type?: string;
        entity_id?: number;
        entity_name?: string;
        description: string;
        metadata?: any;
        ip_address?: string;
    }): Promise<void> {
        try {
            console.log('--- AUDIT LOG INCOMING ---', params);
            const moduleId = await this.getModuleId(params.module);
            const actionId = await this.getActionId(params.action);

            await AuditLogEntity.save({
                company_id: params.company_id,
                member_id: params.member_id,
                module_id: moduleId,
                action_id: actionId,
                entity_type: params.entity_type || '',
                entity_id: params.entity_id || null,
                entity_name: params.entity_name || '',
                description: params.description,
                metadata: params.metadata || {},
                ip_address: params.ip_address || '',
            });
        } catch (error) {
            console.error('AuditLogService.log error:', error);
        }
    }

    static async logFailureIncident(params: {
        company_id: number;
        member_id: number;
        module: string;
        entity_type?: string;
        entity_id?: number;
        entity_name?: string;
        description?: string;
        reason?: any;
        metadata?: any;
        ip_address?: string;
    }): Promise<void> {
        const reason = this.extractFailureReason(params.reason, params.metadata);
        const baseDescription = params.description || `${params.entity_name || params.module} failed`;
        const description = reason && !baseDescription.includes(reason)
            ? `${baseDescription}. Reason: ${reason}`
            : baseDescription;

        await this.log({
            company_id: params.company_id,
            member_id: params.member_id,
            module: params.module,
            action: 'FAILED',
            entity_type: params.entity_type,
            entity_id: params.entity_id,
            entity_name: params.entity_name,
            description,
            metadata: {
                ...(params.metadata || {}),
                ...(reason ? { failure_reason: reason } : {}),
            },
            ip_address: params.ip_address,
        });
    }

    /**
     * Fetch paginated & filtered audit logs for a company.
     */
    async prepareQuery(param: any): Promise<any> {
        try {
            console.log("--- AUDIT LOG prepareQuery param ---", JSON.stringify(param));
            // Accept filters either at the request root or inside filterOptions.
            const filters = { ...param, ...(param.filterOptions || {}) };

            const {
                company_id,
                module,
                action,
                member_id,
                search,
                sort_order = 'DESC'
            } = filters;

            const page = param.page_number || filters.page || 1;
            const page_size = param.page_size || filters.page_size || 10;
            const decryptToken = param.decryptToken;

            const companyId = company_id || decryptToken?.company_id;
            if (!companyId) {
                return { records: [], totalRecords: 0, page, pageSize: page_size };
            }

            const whereCondition: any = {
                company_id: companyId,
                is_delete: 0,
            };

            const createdAtRange = this.resolveCreatedAtRange(filters);
            if (createdAtRange) {
                whereCondition.created_at = Between(createdAtRange.start, createdAtRange.end);
            }

            if (module && module !== 'All') {
                if (Array.isArray(module)) {
                    const { In } = require('typeorm');
                    whereCondition.module = { name: In(module.map((m: string) => m.toUpperCase())) };
                } else {
                    whereCondition.module = { name: module.toUpperCase() };
                }
            }
            if (action && action !== 'All') {
                whereCondition.action = { name: action.toUpperCase() };
            }
            if (member_id) {
                whereCondition.member_id = member_id;
            }
            const [records, totalRecords] = await AuditLogEntity.findAndCount({
                where: search ? [
                    { ...whereCondition, description: ILike(`%${search}%`) },
                    { ...whereCondition, entity_name: ILike(`%${search}%`) }
                ] : whereCondition,
                relations: ['module', 'action'],
                order: { created_at: sort_order },
                skip: (page - 1) * page_size,
                take: page_size,
            });

            // Enrich with member details
            const memberIds = [...new Set(records.map(r => r.member_id).filter(Boolean))];
            let membersMap: Record<number, any> = {};

            if (memberIds.length > 0) {
                const members = await MembersEntity.find({
                    where: { id: In(memberIds), is_delete: 0 }
                });
                for (const m of members) {
                    membersMap[m.id] = m;
                }
            }

            const enrichedRecords = [];
            for (const record of records) {
                const member = membersMap[record.member_id];
                const enriched: any = { ...record };
                enriched.module = record.module?.name;

                let actionName = record.action?.name || '';
                const upperAction = actionName.toUpperCase();
                if (upperAction === 'CREATE') {
                    actionName = 'Created';
                } else if (upperAction === 'DELETE') {
                    actionName = 'Deleted';
                } else if (upperAction === 'UPDATE') {
                    actionName = 'Updated';
                } else if (upperAction === 'PAUSE') {
                    actionName = 'Paused';
                } else if (upperAction === 'RESUME') {
                    actionName = 'Resumed';
                } else if (actionName) {
                    actionName = actionName.charAt(0).toUpperCase() + actionName.slice(1).toLowerCase();
                }

                enriched.action = actionName;
                enriched.member_name = member?.full_name || '';
                enriched.member_profile_picture = '';

                if (member) {
                    const profilePic = member.profile_picture;
                    if (!profilePic || profilePic.trim() === '') {
                        enriched.member_profile_picture = null;
                    } else if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
                        enriched.member_profile_picture = profilePic;
                    } else {
                        try {
                            enriched.member_profile_picture = await this.generateSignedUrl('members', member.id, profilePic);
                        } catch {
                            enriched.member_profile_picture = null;
                        }
                    }
                }

                enrichedRecords.push(enriched);
            }

            return {
                data: enrichedRecords,
                pagination: {
                    total: totalRecords,
                    pageSize: page_size,
                    pageNumber: page,
                },
            };
        } catch (error) {
            console.error('AuditLogService.prepareQuery error:', error);
            throw error;
        }
    }

    /**
     * Get distinct members who have audit log entries for a company (for "Created By" filter).
     */
    async getAuditLogMembers(param: any): Promise<any> {
        try {
            const companyId = param.company_id || param.decryptToken?.company_id;
            if (!companyId) return [];

            const memberRoles = await CompanyMemberRolesEntity.find({
                where: { company_id: companyId, is_delete: 0 },
            });
            const memberIds = memberRoles.map(r => r.member_id).filter(Boolean);

            if (memberIds.length === 0) return [];

            const members = await MembersEntity.find({
                where: { id: In(memberIds) },
                select: ['id', 'full_name', 'profile_picture'],
            });

            if (members.length === 0) return [];

            const enrichedMembers = [];
            for (const member of members) {
                const m: any = {
                    id: member.id,
                    full_name: member.full_name,
                    profile_picture: null,
                };
                const profilePic = member.profile_picture;
                if (!profilePic || profilePic.trim() === '') {
                    m.profile_picture = null;
                } else if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
                    m.profile_picture = profilePic;
                } else {
                    try {
                        m.profile_picture = await this.generateSignedUrl('members', member.id, profilePic);
                    } catch {
                        m.profile_picture = null;
                    }
                }
                enrichedMembers.push(m);
            }

            return enrichedMembers;
        } catch (error) {
            console.error('AuditLogService.getAuditLogMembers error:', error);
            throw error;
        }
    }

    /**
     * Get distinct modules that have audit log entries for a company (for "Module" filter).
     */
    async getAuditLogModules(param: any): Promise<any> {
        try {
            const modules = await AuditLogModuleEntity.find({
                select: ['name'],
                where: { is_delete: 0 }
            });
            return modules.map(m => m.name).filter(Boolean);
        } catch (error) {
            console.error('AuditLogService.getAuditLogModules error:', error);
            throw error;
        }
    }

    /**
     * Get distinct actions that have audit log entries for a company (for "Status" filter).
     */
    async getAuditLogActions(param: any): Promise<any> {
        try {
            const actions = await AuditLogActionEntity.find({
                select: ['name'],
                where: { is_delete: 0 }
            });
            return actions.map(a => a.name).filter(Boolean);
        } catch (error) {
            console.error('AuditLogService.getAuditLogActions error:', error);
            throw error;
        }
    }
}

export default AuditLogService;
