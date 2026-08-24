import { In } from 'typeorm';
import { AwsService } from '../../core/AwsService';
import moment from 'moment';
import { BaseServices } from '../baseService.services';
import { KnowledgeBaseEntity } from '../../entities/knowledgeBaseEntity';
import { KnowledgeBaseModel } from '../../database/repository/knowledgeBase/knowledgeBase.model';
import { KnowledgeBaseDto } from '../../database/repository/knowledgeBase/knowledgeBase.dto';
import { MembersEntity } from '../../entities/membersEntity';
import { Pagination, KnowledgeBaseFilter } from '../../core/InferParams';
import { KAFKAPRODUCERS, KnowledgeBaseStatus, ModuleType, NotificationType, WalletTxnReferenceType } from '../../config';
import { WebSocketService } from '../../utils/webSocket/webSocketService';
import { NotificationService } from '../notification/notificationService.services';
import { NotificationModel } from '../../database/repository/notification/notification.model';
import { KafkaService } from '../../utils/kafka/KafkaService';
import { KnowledgeBaseSourceEntity } from '../../entities/knowledgeBaseSourceEntity';
import { EmbeddingModelEntity } from '../../entities/embeddingModelEntity';
import { KnowledgeBaseVectorStoreEntity } from '../../entities/knowledgeBaseVectorStoreEntity';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CloudSecretsEntity } from '../../entities/cloudSecretsEntity';
import CloudSecretsService from '../cloudSecrets/cloudSecretsService.service';
import { CloudRegionEntity } from '../../entities/cloudRegionEntity';
import KnowledgeBaseSourceMappingService from './knowledgeBaseSourceMappingService.services';
import { KnowledgeBaseJobService } from './knowledgeBaseJobService.services';
import { KnowledgeBaseJobStatus } from '../../config';
import { DeploymentKbIntegrationEntity } from '../../entities/deploymentKbIntegrationEntity';
import AuditLogService from '../auditLog/auditLogService.services';

class KnowledgeBaseService extends BaseServices {
    constructor(entity: any = KnowledgeBaseEntity, protected awsService: AwsService = new AwsService(), protected notificationService: NotificationService = new NotificationService()) {
        super(entity, awsService);
    }

    getModel(): KnowledgeBaseModel {
        return new KnowledgeBaseModel();
    }

    getDTO(): any {
        return KnowledgeBaseDto;
    }

    getModuleName(): string {
        return 'Knowledge Base';
    }

    override transformModel(model: KnowledgeBaseModel): KnowledgeBaseModel {
        model.member_id = model.decryptToken?.member_id;
        model.company_id = model.company_id;
        if (model.source_details) {
            model.source_type_id = model.source_details.source_type_id ?? model.source_type_id;
            model.cloud_provider_id = model.source_details.cloud_provider_id ?? model.source_details.provider_id ?? model.cloud_provider_id;
            model.cloud_secret_id = model.source_details.cloud_secret_id ?? model.source_details.secret_id ?? model.cloud_secret_id;
            model.region_id = model.source_details.region_id ?? model.region_id;
            model.auto_sync = model.source_details.auto_sync ?? model.source_details.autoSync ?? model.auto_sync;
            model.sync_frequency = model.source_details.sync_frequency ?? model.source_details.syncFrequency ?? model.sync_frequency;
            model.sync_time = model.source_details.sync_time ?? model.source_details.syncTime ?? model.sync_time;
            model.sync_day = model.source_details.sync_day ?? model.source_details.syncDay ?? model.sync_day;
        }

        if (model.embedding_details) {
            model.embedding_model_id = model.embedding_details.embedded_model_id;
        }
        if (model.vector_store_details) {
            model.vector_store_id = model.vector_store_details.vector_store_id;
        }
        return model;
    }

    override async prepareQuery(param: KnowledgeBaseFilter): Promise<any> {
        try {
            // Subquery to count active deployment integrations per knowledge base
            const deploymentCountSubquery = DeploymentKbIntegrationEntity
                .createQueryBuilder('dki')
                .select('COUNT(dki.id)')
                .where('dki.knowledge_base_id = kb.id')
                .andWhere('dki.is_active = true')
                .andWhere('dki.is_delete = 0')
                .getQuery();

            const query = this.entity
                .createQueryBuilder('kb')
                .leftJoinAndSelect(MembersEntity, 'member', 'member.id = kb.member_id')
                .select([
                    'kb.id as id',
                    'kb.name as name',
                    'kb.description as description',
                    'kb.source_type_id as source_type_id',
                    'kb.cloud_provider_id as cloud_provider_id',
                    'kb.cloud_secret_id as cloud_secret_id',
                    'kb.region_id as region_id',
                    'kb.auto_sync as auto_sync',
                    'kb.sync_frequency as sync_frequency',
                    'kb.chunking_details as chunking_details',
                    'kb.chunking_type as chunking_type',

                    'kb.embedding_details as embedding_details',
                    'kb.embedding_model_id as embedding_model_id',
                    'kb.vector_store_details as vector_store_details',
                    'kb.vector_store_id as vector_store_id',
                    'kb.source_details as source_details',
                    'kb.status as status',
                    'kb.failure_message as failure_message',
                    'kb.created_at as created_at',
                    'kb.modified_at as modified_at',
                    'member.full_name as created_by',
                    'member.profile_picture as profile_picture',
                    'kb.member_id as member_id',
                ])
                .addSelect(`(${deploymentCountSubquery})`, 'deployment_count')
                .where('kb.company_id = :companyId', { companyId: param.company_id });

            if (param.is_delete !== undefined) {
                query.andWhere('kb.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                query.andWhere('kb.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                query.andWhere(
                    '(LOWER(kb.name) LIKE :search)',
                    { search: searchText }
                );
            }
            if (param.chunking_type) {
                query.andWhere('kb.chunking_type = :chunkingType', { chunkingType: param.chunking_type });
            }


            if (param.status) {
                const statusFilter = param.status.toLowerCase();
                if (statusFilter === 'completed') {
                    query.andWhere('kb.status = :status', { status: KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE });
                } else if (statusFilter === 'failed') {
                    query.andWhere('kb.status = :status', { status: KnowledgeBaseStatus.FAILED });
                } else if (statusFilter === 'inprogress') {
                    query.andWhere('kb.status NOT IN (:...terminalStatuses)', {
                        terminalStatuses: [KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE, KnowledgeBaseStatus.FAILED],
                    });
                } else {
                    query.andWhere('kb.status = :status', { status: param.status });
                }
            }

            query.orderBy('kb.id', 'DESC');

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                query.offset(offset).limit(param.pageSize);
            }

            const records = await query.getRawMany();

            const countQuery = this.entity
                .createQueryBuilder('kb')
                .where('kb.company_id = :companyId', { companyId: param.company_id });

            if (param.is_delete !== undefined) {
                countQuery.andWhere('kb.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                countQuery.andWhere('kb.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                countQuery.andWhere(
                    '(LOWER(kb.name) LIKE :search)',
                    { search: searchText }
                );
            }

            if (param.chunking_type) {
                countQuery.andWhere('kb.chunking_type = :chunkingType', { chunkingType: param.chunking_type });
            }



            if (param.status) {
                const statusFilter = param.status.toLowerCase();
                if (statusFilter === 'completed') {
                    countQuery.andWhere('kb.status = :status', { status: KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE });
                } else if (statusFilter === 'failed') {
                    countQuery.andWhere('kb.status = :status', { status: KnowledgeBaseStatus.FAILED });
                } else if (statusFilter === 'inprogress') {
                    countQuery.andWhere('kb.status NOT IN (:...terminalStatuses)', {
                        terminalStatuses: [KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE, KnowledgeBaseStatus.FAILED],
                    });
                } else {
                    countQuery.andWhere('kb.status = :status', { status: param.status });
                }
            }

            const total = await countQuery.getCount();

            const formattedRecords = await Promise.all(
                records.map(async (record) => {
                    let profilePictureUrl = record.profile_picture;
                    if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
                        try {
                            profilePictureUrl = await this.generateSignedUrl('members', record.member_id, record.profile_picture);
                        } catch {
                            profilePictureUrl = null;
                        }
                    }
                    return { ...record, profile_picture: profilePictureUrl, deployment_count: parseInt(record.deployment_count || '0', 10) };
                })
            );

            return Promise.resolve({
                data: formattedRecords,
                pagination: { total, pageSize: param.pageSize, pageNumber: param.pageNumber },
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: Pagination): Promise<any> {
        try {
            const query = this.entity
                .createQueryBuilder('kb')
                .leftJoinAndMapOne('kb.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = kb.source_type_id')
                .leftJoinAndMapOne('kb.embedding_model_details', EmbeddingModelEntity, 'embeddingModel', 'embeddingModel.id = kb.embedding_model_id')
                .leftJoinAndMapOne('kb.vector_store_info', KnowledgeBaseVectorStoreEntity, 'vectorStore', 'vectorStore.id = kb.vector_store_id')
                .leftJoinAndMapOne('kb.cloud_provider_details', CloudProviderEntity, 'cloudProvider', 'cloudProvider.id = kb.cloud_provider_id')
                .leftJoinAndMapOne('kb.cloud_secret_details', CloudSecretsEntity, 'cloudSecret', 'cloudSecret.id = kb.cloud_secret_id')
                .leftJoinAndMapOne('kb.region_details', CloudRegionEntity, 'cloudRegion', 'cloudRegion.id = kb.region_id')
                .leftJoinAndMapOne('kb.member_details', MembersEntity, 'member', 'member.id = kb.member_id')
                .where('kb.id = :id', { id: param.id })
                .andWhere('kb.is_delete = 0');

            const record = await query.getOne();
            if (!record) return Promise.reject('E10065');

            let profilePictureUrl = record.member_details?.profile_picture;
            if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
                try {
                    profilePictureUrl = await this.generateSignedUrl('members', record.member_id, record.member_details.profile_picture);
                } catch {
                    profilePictureUrl = null;
                }
            }

            const jobService = new KnowledgeBaseJobService();
            const latestJob = await jobService.entity.findOne({
                where: { knowledge_base_id: param.id, is_delete: 0 },
                order: { id: 'DESC' }
            });

            const deploymentCount = await DeploymentKbIntegrationEntity
                .createQueryBuilder('dki')
                .where('dki.knowledge_base_id = :kbId', { kbId: param.id })
                .andWhere('dki.is_active = true')
                .andWhere('dki.is_delete = 0')
                .getCount();

            const response: any = {
                ...record,
                created_by: record.member_details?.full_name,
                profile_picture: profilePictureUrl,
                job_id: latestJob ? latestJob.id : null,
                deployment_count: deploymentCount
            };

            // Sync top-level fields into source_details for Gaurav (frontend)
            if (response.source_details) {
                response.source_details.auto_sync = record.auto_sync;
                response.source_details.sync_frequency = record.sync_frequency;
                response.source_details.sync_time = record.sync_time;
                response.source_details.sync_day = record.sync_day;
            }

            // Remove top-level sync fields as requested by frontend
            delete response.auto_sync;
            delete response.sync_frequency;
            delete response.sync_time;
            delete response.sync_day;

            // Fetch all source mappings for this Knowledge Base
            const sourceMappingService = new KnowledgeBaseSourceMappingService();
            const sources = await sourceMappingService.entity
                .createQueryBuilder('sm')
                .leftJoinAndMapOne('sm.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = sm.source_type_id')
                .where('sm.knowledge_base_id = :kbId', { kbId: param.id })
                .andWhere('sm.is_delete = 0')
                .getMany();

            response.sources = sources.map(s => ({
                ...s,
                source_type_name: (s as any).source_type_details?.name
            }));

            return response;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override async createPostProcess(
        result: KnowledgeBaseModel,
        model: KnowledgeBaseModel,
        _files: any
    ): Promise<KnowledgeBaseModel> {
        return new Promise(async (resolve) => {
            try {
                const isUpdate = !!model.id;

                // 1. Update scheduling for the Knowledge Base
                const kb = await KnowledgeBaseEntity.findOneBy({ id: result.id });
                if (kb) {
                    if (kb.auto_sync !== false && kb.sync_frequency && kb.sync_frequency.toLowerCase() !== 'none') {
                        kb.next_sync_at = this.calculateNextRun(
                            kb.sync_frequency,
                            kb.sync_time,
                            kb.sync_day
                        );
                    } else {
                        kb.next_sync_at = null as any;
                    }
                    await KnowledgeBaseEntity.save(kb);
                    console.log(`[KnowledgeBase] Scheduling updated for KB ${result.id}. Next sync: ${kb.next_sync_at}`);
                }

                if (isUpdate) {
                    // For updates, we skip the initial creation logic (Job creation, Kafka trigger, Notifications)
                    resolve(result);
                    return;
                }

                // --------- INITIALIZATION (CREATE ONLY) ---------
                const jobService = new KnowledgeBaseJobService();
                const jobModel = jobService.getModel();
                jobModel.knowledge_base_id = result.id;
                jobModel.company_id = result.company_id;
                jobModel.status = KnowledgeBaseJobStatus.PENDING;
                delete (jobModel as any).id;
                const jobRecord = await jobService.createRecord(jobModel, null);

                const sourceTypeId = result.source_details?.source_type_id;
                const sourceMappingService = new KnowledgeBaseSourceMappingService();

                if (result.id && sourceTypeId) {
                    const sourceMappingModel = sourceMappingService.getModel();
                    sourceMappingModel.knowledge_base_id = result.id;
                    sourceMappingModel.member_id = result.member_id;
                    sourceMappingModel.decryptToken = model.decryptToken;
                    sourceMappingModel.source_type_id = sourceTypeId;
                    sourceMappingModel.cloud_provider_id = result.cloud_provider_id ?? result.source_details?.cloud_provider_id ?? result.source_details?.provider_id ?? null;
                    sourceMappingModel.cloud_secret_id = result.cloud_secret_id ?? result.source_details?.cloud_secret_id ?? result.source_details?.secret_id ?? null;
                    sourceMappingModel.region_id = result.region_id ?? result.source_details?.region_id ?? null;
                    console.log('[KnowledgeBase] createPostProcess result source_details:', JSON.stringify(result.source_details, null, 2));
                    console.log('[KnowledgeBase] createPostProcess original model source_details:', JSON.stringify(model.source_details, null, 2));
                    sourceMappingModel.source_details = model.source_details ?? result.source_details ?? null;
                    sourceMappingModel.status = 'active';
                    (sourceMappingModel as any).isInitialSource = true;
                    delete (sourceMappingModel as any).id;

                    await sourceMappingService.createRecord(sourceMappingModel, null);
                } else {
                    // Fallback if no source mapping is created, trigger Kafka directly
                    await sourceMappingService.triggerKafkaUpdate(result.id, jobRecord.id);
                }

                // 2. WebSocket push
                const allSources = await sourceMappingService.entity.find({
                    where: { knowledge_base_id: result.id, is_delete: 0 }
                });
                await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
                    module: ModuleType.RAG,
                    entity: {
                        ...result,
                        sources: allSources
                    },
                });

                // 3. Notification
                let userName = 'User';
                if (result.member_id) {
                    const member = await MembersEntity.findOneBy({ id: result.member_id });
                    if (member) userName = member.full_name;
                }
                const notificationModel = new NotificationModel();
                notificationModel.user_id = result.member_id;
                notificationModel.message = `${userName} created a new Knowledge Base: ${result.name}`;
                notificationModel.notification_type = NotificationType.CREATED;
                notificationModel.module_name = ModuleType.RAG;
                notificationModel.is_readed = false;
                notificationModel.company_id = result.company_id;
                await this.notificationService.createRecord(notificationModel, null);

                // Track secret usage
                if (result.cloud_secret_id) {
                    CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id, 'Knowledge Base');
                }

                await AuditLogService.log({
                    company_id: result.company_id,
                    member_id: result.member_id,
                    module: this.getModuleName(),
                    action: 'CREATE',
                    entity_type: 'KnowledgeBaseEntity',
                    entity_id: result.id,
                    entity_name: result.name,
                    description: `Created Knowledge Base '${result.name}'`,
                    ip_address: '',
                });

                resolve(result);
            } catch (error) {
                console.error('KnowledgeBase createPostProcess error:', error);
                resolve(result);
            }
        });
    }

    private getStatusOrder(status: string): number {
        const order: Record<string, number> = {
            'PENDING': 0,
            'FAILED': 1,
            'REQUEST_RECEIVED': 2,
            'PREPARING_DATA': 3,
            'PROCESSING_DOCUMENTS': 4,
            'CREATING_EMBEDDINGS': 5,
            'SAVING_TO_KNOWLEDGE_BASE': 6,
            'COMPLETED': 7
        };
        return order[status] ?? 0;
    }

    async updateStatus(payload: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const kbId = payload.knowledge_base_id || payload.id;
                const record = await this.entity.createQueryBuilder('kb')
                    .leftJoinAndMapOne('kb.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = kb.source_type_id')
                    .leftJoinAndMapOne('kb.embedding_model_details', EmbeddingModelEntity, 'embeddingModel', 'embeddingModel.id = kb.embedding_model_id')
                    .leftJoinAndMapOne('kb.vector_store_info', KnowledgeBaseVectorStoreEntity, 'vectorStore', 'vectorStore.id = kb.vector_store_id')
                    .leftJoinAndMapOne('kb.cloud_provider_details', CloudProviderEntity, 'cloudProvider', 'cloudProvider.id = kb.cloud_provider_id')
                    .leftJoinAndMapOne('kb.cloud_secret_details', CloudSecretsEntity, 'cloudSecret', 'cloudSecret.id = kb.cloud_secret_id')
                    .leftJoinAndMapOne('kb.region_details', CloudRegionEntity, 'cloudRegion', 'cloudRegion.id = kb.region_id')
                    .leftJoinAndMapOne('kb.member_details', MembersEntity, 'member', 'member.id = kb.member_id')
                    .where('kb.id = :id', { id: Number(kbId) })
                    .getOne();

                if (!record) {
                    console.error(`[KnowledgeBase] updateStatus: Knowledge Base with ID ${kbId} not found in database.`);
                    return reject('E10065');
                }

                let jobRecord: any = null;
                const jobService = new KnowledgeBaseJobService();

                if (payload.job_id) {
                    jobRecord = await jobService.entity.findOneBy({ id: Number(payload.job_id) });

                    if (!jobRecord) {
                        console.warn(`[KnowledgeBase] updateStatus: job_id ${payload.job_id} provided but not found in DB. KB: ${kbId}`);
                        // Try to fallback to latest job if job_id was not found but KB is valid
                        jobRecord = await jobService.entity.findOne({
                            where: { knowledge_base_id: Number(kbId) },
                            order: { id: 'DESC' }
                        });
                    } else {
                        const latestJob = await jobService.entity.findOne({
                            where: { knowledge_base_id: Number(kbId) },
                            order: { id: 'DESC' }
                        });

                        if (latestJob && jobRecord.id < latestJob.id) {
                            console.warn(`[KnowledgeBase] Ignoring status for old job. KB: ${kbId}, Payload Job: ${payload.job_id}, Latest Job: ${latestJob.id}`);
                            return resolve(true);
                        }
                    }
                }

                const incomingStatus = payload.completed ? KnowledgeBaseJobStatus.COMPLETED : payload.status;
                const dbStatus = payload.status || (payload.completed ? KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE : undefined);
                const isPayloadFailed = dbStatus === KnowledgeBaseStatus.FAILED || payload.failed === true;

                console.log(`[KnowledgeBase] updateStatus: KB ${kbId} | Job ${payload.job_id} | Payload Status: ${payload.status} | Failed: ${isPayloadFailed}`);

                // Update individual source mapping status if provided (Done before order check for granular tracking)
                const success_ids = new Set<number>();
                const failed_ids = new Set<number>();

                const incomingSourceMappingId = payload.source_mapping_id || payload.source_id;

                // 1. Identify successful/in-progress IDs
                if (incomingSourceMappingId && !isPayloadFailed) {
                    success_ids.add(Number(incomingSourceMappingId));
                }
                if (!isPayloadFailed && payload.source_mapping_ids && Array.isArray(payload.source_mapping_ids)) {
                    payload.source_mapping_ids.forEach((id: any) => success_ids.add(Number(id)));
                }
                if (payload.processed_files && Array.isArray(payload.processed_files)) {
                    payload.processed_files.forEach((f: any) => (f.source_mapping_id || f.source_id) && success_ids.add(Number(f.source_mapping_id || f.source_id)));
                }

                // 2. Identify failed IDs
                if (isPayloadFailed) {
                    if (incomingSourceMappingId) {
                        failed_ids.add(Number(incomingSourceMappingId));
                    }
                    if (payload.source_mapping_ids && Array.isArray(payload.source_mapping_ids)) {
                        payload.source_mapping_ids.forEach((id: any) => failed_ids.add(Number(id)));
                    }
                }
                if (payload.failed_files && Array.isArray(payload.failed_files)) {
                    payload.failed_files.forEach((f: any) => (f.source_mapping_id || f.source_id) && failed_ids.add(Number(f.source_mapping_id || f.source_id)));
                }

                const sourceMappingService = new KnowledgeBaseSourceMappingService();

                // Clean up: if it failed, it's not successful
                failed_ids.forEach(id => success_ids.delete(id));

                // Perform updates for sources
                if (success_ids.size > 0 && dbStatus) {
                    const ids = Array.from(success_ids);
                    await sourceMappingService.entity.update({ id: In(ids) }, { source_status: dbStatus });
                }
                if (failed_ids.size > 0) {
                    const ids = Array.from(failed_ids);
                    await sourceMappingService.entity.update({ id: In(ids) }, { source_status: KnowledgeBaseStatus.FAILED });
                }

                // 3. Dynamic KB Status Calculation: Find the "Bottleneck" status among all active sources
                const allSources = await sourceMappingService.entity
                    .createQueryBuilder('sm')
                    .leftJoinAndMapOne('sm.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = sm.source_type_id')
                    .leftJoinAndMapOne('sm.cloud_provider_details', CloudProviderEntity, 'cloudProvider', 'cloudProvider.id = sm.cloud_provider_id')
                    .leftJoinAndMapOne('sm.cloud_secret_details', CloudSecretsEntity, 'cloudSecret', 'cloudSecret.id = sm.cloud_secret_id')
                    .leftJoinAndMapOne('sm.member_details', MembersEntity, 'member', 'member.id = sm.member_id')
                    .where('sm.knowledge_base_id = :kbId', { kbId: Number(kbId) })
                    .andWhere('sm.is_delete = 0')
                    .getMany();

                const formattedSources = await Promise.all(allSources.map(async (s) => {
                    let cloudProviderImage = (s as any).cloud_provider_details?.cloud_provider_image;
                    if (cloudProviderImage && !cloudProviderImage.startsWith("http")) {
                        try {
                            cloudProviderImage = await this.generateSignedUrl("cloudProviderMedia", (s as any).cloud_provider_id, cloudProviderImage);
                        } catch (_error) {
                            cloudProviderImage = null;
                        }
                    }

                    let sourceTypeIcon = (s as any).source_type_details?.icon;
                    if (sourceTypeIcon && !sourceTypeIcon.startsWith("http")) {
                        try {
                            sourceTypeIcon = await this.generateSignedUrl("knowledge_base_source", (s as any).source_type_id, sourceTypeIcon);
                        } catch (_error) {
                            sourceTypeIcon = null;
                        }
                    }

                    let profileImage = (s as any).member_details?.profile_picture;
                    if (profileImage && !profileImage.startsWith("http")) {
                        try {
                            profileImage = await this.generateSignedUrl("members", (s as any).member_id, profileImage);
                        } catch (_error) {
                            profileImage = null;
                        }
                    }

                    return {
                        id: s.id,
                        knowledge_base_id: s.knowledge_base_id,
                        source_type_id: s.source_type_id,
                        source_type_name: (s as any).source_type_details?.name,
                        source_type: (s as any).source_type_details?.name,
                        source_type_icon: sourceTypeIcon,
                        cloud_provider_id: s.cloud_provider_id,
                        cloud_provider_name: (s as any).cloud_provider_details?.name,
                        cloud_provider_image: cloudProviderImage,
                        cloud_secret_id: s.cloud_secret_id,
                        cloud_secret_name: (s as any).cloud_secret_details?.name,
                        region_id: s.region_id,
                        status: s.status,
                        source_status: s.source_status,
                        created_at: s.created_at,
                        modified_at: s.modified_at,
                        member_id: s.member_id,
                        user_name: (s as any).member_details?.full_name,
                        profile_image: profileImage,
                    };
                }));

                let finalKbStatus: string;
                const nonFailedStatuses = formattedSources
                    .map(s => s.source_status)
                    .filter(s => s !== KnowledgeBaseStatus.FAILED);

                if (nonFailedStatuses.length === 0) {
                    // All active sources have failed (or no sources exist)
                    finalKbStatus = KnowledgeBaseStatus.FAILED;
                } else {
                    // Pick the status with the MINIMUM progress (the bottleneck)
                    let minOrder = 999;
                    let minStatus = nonFailedStatuses[0];

                    for (const s of nonFailedStatuses) {
                        const order = this.getStatusOrder(s);
                        if (order < minOrder) {
                            minOrder = order;
                            minStatus = s;
                        }
                    }
                    finalKbStatus = minStatus;
                }

                // Map 'COMPLETED' (job status) to 'SAVING_TO_KNOWLEDGE_BASE' (kb status)
                if (finalKbStatus === 'COMPLETED' || finalKbStatus === KnowledgeBaseJobStatus.COMPLETED) {
                    finalKbStatus = KnowledgeBaseStatus.SAVING_TO_KNOWLEDGE_BASE;
                }

                // 4. Update the Knowledge Base record (with regression check)
                const oldStatus = record.status;
                const oldOrder = this.getStatusOrder(oldStatus);
                const newOrder = this.getStatusOrder(finalKbStatus);

                let kbStatusToPersist = finalKbStatus;
                // Prevent regression: Only update if the new status is "further" in the pipeline
                // or if it's a FAILED status (which is always important)
                if (newOrder < oldOrder && finalKbStatus !== KnowledgeBaseStatus.FAILED && oldStatus !== KnowledgeBaseStatus.FAILED) {
                    kbStatusToPersist = oldStatus;
                }

                // Update the Knowledge Base record
                const isKbNowFailed = kbStatusToPersist === KnowledgeBaseStatus.FAILED;
                const failureMsg = payload.failure_message ?? payload.error ?? payload.message ?? record.failure_message;

                await this.entity.update(
                    { id: record.id },
                    {
                        status: kbStatusToPersist as any,
                        failure_message: isKbNowFailed ? failureMsg : record.failure_message,
                    }
                );

                record.status = kbStatusToPersist;
                record.failure_message = isKbNowFailed ? failureMsg : record.failure_message;

                // Sign KB level profile picture
                let kbProfilePicture = record.member_details?.profile_picture;
                if (kbProfilePicture && !kbProfilePicture.startsWith('http')) {
                    try {
                        kbProfilePicture = await this.generateSignedUrl('members', record.member_id, kbProfilePicture);
                    } catch {
                        kbProfilePicture = null;
                    }
                }
                record.profile_picture = kbProfilePicture;


                let socketModule: any = ModuleType.RAG;
                if (payload.is_source === true) {
                    socketModule = ModuleType.KNOWLEDGEBASE_SOURCE;
                }

                // WebSocket push if:
                // 1. Global Status changed
                // 2. It's a source-level update (real-time progress)
                // 3. Something failed (even if aggregate status didn't change)
                const shouldPush = oldStatus !== kbStatusToPersist ||
                    socketModule === ModuleType.KNOWLEDGEBASE_SOURCE ||
                    isPayloadFailed;

                if (shouldPush) {
                    let entityToSend: any;

                    if (socketModule === ModuleType.KNOWLEDGEBASE_SOURCE) {
                        // Send only the specific updated source (Clean flat record)
                        const searchId = Number(incomingSourceMappingId || Array.from(success_ids)[0] || Array.from(failed_ids)[0]);
                        const specificSource = formattedSources.find(s => s.id === searchId);

                        if (!specificSource) {
                            console.warn(`[KnowledgeBase] updateStatus: specificSource not found for ID ${searchId}. Fallback to first source.`);
                            entityToSend = formattedSources[0] || {};
                        } else {
                            // Ensure the entity status matches the payload status
                            specificSource.source_status = dbStatus || payload.status || specificSource.source_status;
                            entityToSend = specificSource;
                        }
                    } else {
                        // Send the full Knowledge Base record (Rich data like Get By ID)
                        // Create a clean version of the record without raw nested join objects
                        const cleanRecord = { ...record };
                        delete (cleanRecord as any).member_details;
                        delete (cleanRecord as any).source_type_details;
                        delete (cleanRecord as any).embedding_model_details;
                        delete (cleanRecord as any).vector_store_info;
                        delete (cleanRecord as any).cloud_provider_details;
                        delete (cleanRecord as any).cloud_secret_details;
                        delete (cleanRecord as any).region_details;
                        delete (cleanRecord as any).source_details;

                        entityToSend = {
                            ...cleanRecord,
                            created_by: record.member_details?.full_name,
                            profile_picture: record.profile_picture,
                            status: kbStatusToPersist,
                            sources: formattedSources,
                        };
                    }

                    const messagePayload: any = {
                        module: socketModule,
                        entity: entityToSend,
                    };

                    await WebSocketService.pushMessageToCompany(record.company_id.toString(), messagePayload);
                }

                // Notification on terminal states (completed or global failure)
                const isGlobalFailure = isKbNowFailed;
                if (isGlobalFailure && oldStatus !== KnowledgeBaseStatus.FAILED) {
                    await AuditLogService.logFailureIncident({
                        company_id: record.company_id,
                        member_id: record.member_id,
                        module: this.getModuleName(),
                        entity_type: 'KnowledgeBaseEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Knowledge Base ${record.name} failed`,
                        reason: failureMsg,
                        metadata: {
                            kafka_payload: payload,
                            job_id: jobRecord?.id || payload.job_id,
                            previous_status: oldStatus,
                            current_status: kbStatusToPersist,
                        },
                    });
                }

                if (payload.completed === true || isGlobalFailure) {
                    const member = await MembersEntity.findOneBy({ id: record.member_id });
                    const statusText = payload.completed === true ? 'is ready' : 'failed to process';

                    const notificationModel = new NotificationModel();
                    notificationModel.user_id = record.member_id;
                    notificationModel.message = `Knowledge Base "${record.name}" ${statusText}`;
                    notificationModel.notification_type = payload.completed === true
                        ? NotificationType.SUCCESS
                        : NotificationType.FAILED;
                    notificationModel.module_name = ModuleType.RAG;
                    notificationModel.is_readed = false;
                    notificationModel.company_id = record.company_id;
                    await this.notificationService.createRecord(notificationModel, null);

                    // --- BILLING INTEGRATION ---
                    if (payload.completed === true && (payload.total_content_size_bytes > 0 || jobRecord?.total_content_size_bytes > 0)) {
                        try {
                            const costPayload = {
                                company_id: record.company_id,
                                member_id: record.member_id,
                                module: WalletTxnReferenceType.KNOWLEDGEBASE,
                                entity_id: record.id,
                                request: {
                                    knowledge_base_id: record.id,
                                    job_id: jobRecord?.id || payload.job_id,
                                    total_content_size_bytes: payload.total_content_size_bytes || jobRecord?.total_content_size_bytes
                                }
                            };

                            console.log(`[KnowledgeBase] Triggering billing for KB ${record.id}:`, costPayload);
                            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, costPayload);
                        } catch (billingError) {
                            console.error(`[KnowledgeBase] Failed to trigger billing for KB ${record.id}:`, billingError);
                        }
                    }
                }

                // Update Job Status if job_id is present
                if (jobRecord) {
                    let jobStatus = finalKbStatus as any as KnowledgeBaseJobStatus;
                    if (payload.completed === true) {
                        jobStatus = KnowledgeBaseJobStatus.COMPLETED;
                    } else if (isKbNowFailed) {
                        jobStatus = KnowledgeBaseJobStatus.FAILED;
                    }

                    await jobService.entity.update(
                        { id: jobRecord.id },
                        {
                            status: jobStatus,
                            files_processed: payload.files_processed,
                            files_failed: payload.files_failed,
                            vectors_stored: payload.vectors_stored,
                            processed_files: payload.processed_files,
                            failed_files: payload.failed_files,
                            failure_message: isKbNowFailed ? (payload.failure_message ?? payload.error ?? payload.message ?? jobRecord.failure_message) : jobRecord.failure_message,
                            total_content_size_bytes: payload.total_content_size_bytes
                        }
                    );
                }

                resolve(true);
            } catch (error) {
                console.error('KnowledgeBase updateStatus error:', error);
                reject(error);
            }
        });
    }

    async syncNow(kbId: number, companyId: number): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const record = await this.entity.findOneBy({ id: kbId, company_id: companyId });
                if (!record) return reject('E10065');

                const jobService = new KnowledgeBaseJobService();
                const jobModel = jobService.getModel();
                jobModel.knowledge_base_id = record.id;
                jobModel.company_id = record.company_id;
                jobModel.status = KnowledgeBaseJobStatus.PENDING;
                delete (jobModel as any).id;
                const jobRecord = await jobService.createRecord(jobModel, null);

                const sourceMappingService = new KnowledgeBaseSourceMappingService();
                // Reset source statuses for the new job (only for active sources)
                await sourceMappingService.entity.update(
                    { knowledge_base_id: record.id, is_delete: 0, status: 'active' },
                    { source_status: KnowledgeBaseStatus.PENDING }
                );
                await sourceMappingService.triggerKafkaUpdate(record.id, jobRecord.id);

                record.status = KnowledgeBaseStatus.PENDING;
                record.last_sync_at = moment().utcOffset('+05:30').toDate();
                if (record.auto_sync !== false && record.sync_frequency && record.sync_frequency !== 'none') {
                    record.next_sync_at = this.calculateNextRun(
                        record.sync_frequency,
                        record.sync_time,
                        record.sync_day
                    );
                } else {
                    record.next_sync_at = null as any;
                }
                await this.entity.save(record);

                // WebSocket push for Sync Triggered
                const allSources = await sourceMappingService.entity.find({
                    where: { knowledge_base_id: record.id, is_delete: 0 }
                });
                await WebSocketService.pushMessageToCompany(record.company_id.toString(), {
                    module: ModuleType.RAG,
                    entity: {
                        ...record,
                        sources: allSources
                    },
                });

                resolve({ job_id: jobRecord.id, status: 'Triggered' });
            } catch (error) {
                console.error('KnowledgeBase syncNow error:', error);
                reject(error);
            }
        });
    }

    private calculateNextRun(frequency: string, syncTime?: string | null, syncDay?: number | null): any {
        const now = moment().utcOffset('+05:30');
        switch (frequency.toLowerCase()) {
            case 'hourly': return now.add(1, 'hour').toDate();
            case 'daily': {
                if (syncTime) {
                    const [hourStr, minStr] = syncTime.split(':');
                    const targetHour = parseInt(hourStr, 10) || 0;
                    const targetMin = parseInt(minStr, 10) || 0;

                    const runTime = moment().utcOffset('+05:30').set({ hour: targetHour, minute: targetMin, second: 0, millisecond: 0 });
                    if (runTime.isSameOrBefore(now)) {
                        runTime.add(1, 'day');
                    }
                    return runTime.toDate();
                }
                return now.add(1, 'day').toDate();
            }
            case 'weekly': {
                if (syncDay && syncTime) {
                    const [hourStr, minStr] = syncTime.split(':');
                    const targetHour = parseInt(hourStr, 10) || 0;
                    const targetMin = parseInt(minStr, 10) || 0;

                    const runTime = moment().utcOffset('+05:30').day(syncDay).set({ hour: targetHour, minute: targetMin, second: 0, millisecond: 0 });
                    if (runTime.isSameOrBefore(now)) {
                        runTime.add(1, 'week');
                    }
                    return runTime.toDate();
                }
                return now.add(1, 'week').toDate();
            }
            case 'monthly': return now.add(1, 'month').toDate();
            default:
                if (!isNaN(parseInt(frequency))) {
                    return now.add(parseInt(frequency), 'minutes').toDate();
                }
                return null as any;
        }
    }

    public override updateDeleteFlagData = async (param: any): Promise<boolean> => {
        try {
            const whereid = await this.updateDeleteFlagPreProcess(param);
            if (whereid === null) {
                return false;
            }
            const records = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
            if (records && records.length > 0) {
                await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();

                for (const record of records) {
                    await AuditLogService.log({
                        company_id: record.company_id,
                        member_id: param.decryptToken?.member_id || record.member_id,
                        module: this.getModuleName(),
                        action: 'DELETE',
                        entity_type: 'KnowledgeBaseEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Deleted Knowledge Base '${record.name}'`,
                        ip_address: param.ip_address || '',
                    });
                }
                return true;
            } else {
                return false;
            }
        } catch (e) {
            throw e;
        }
    };
}

export default KnowledgeBaseService;
