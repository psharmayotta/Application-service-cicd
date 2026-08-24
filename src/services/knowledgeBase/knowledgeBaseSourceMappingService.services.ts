import { BaseServices } from '../baseService.services';
import axios from 'axios';
import https from 'https';
import { EncryptionAndDecryption } from '../../core/Encryption&Decryption';
import { AwsService } from '../../core/AwsService';
import { KnowledgeBaseSourceMappingModel } from '../../database/repository/knowledgeBaseSourceMapping/knowledgeBaseSourceMapping.model';
import { KnowledgeBaseSourceMappingDto } from '../../database/repository/knowledgeBaseSourceMapping/knowledgeBaseSourceMapping.dto';
import { KnowledgeBaseSourceMappingEntity } from '../../entities/knowledgeBaseSourceMappingEntity';
import { KnowledgeBaseSourceEntity } from '../../entities/knowledgeBaseSourceEntity';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CloudSecretsEntity } from '../../entities/cloudSecretsEntity';
import CloudSecretsService from '../cloudSecrets/cloudSecretsService.service';
import { CloudRegionEntity } from '../../entities/cloudRegionEntity';
import { MembersEntity } from '../../entities/membersEntity';
import { KafkaService } from '../../utils/kafka/KafkaService';
import { KAFKAPRODUCERS, ModuleType, NotificationType, QDRANT_DB_URL, CHUNK_MANAGEMENT_API_URL, INFERENCE_API_URL } from '../../config';
import { NotificationService } from '../notification/notificationService.services';
import { NotificationModel } from '../../database/repository/notification/notification.model';
import { KnowledgeBaseEntity } from '../../entities/knowledgeBaseEntity';
import { KnowledgeBaseDatabaseTypeEntity } from '../../entities/knowledgeBaseDatabaseTypeEntity';
import { KnowledgeBaseVectorStoreEntity } from '../../entities/knowledgeBaseVectorStoreEntity';
import { EmbeddingModelEntity } from '../../entities/embeddingModelEntity';
import { KnowledgeBaseJobService } from './knowledgeBaseJobService.services';
import { KnowledgeBaseJobStatus } from '../../config';
import AuditLogService from '../auditLog/auditLogService.services';

class KnowledgeBaseSourceMappingService extends BaseServices {
    constructor(
        entity: any = KnowledgeBaseSourceMappingEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): KnowledgeBaseSourceMappingModel {
        return new KnowledgeBaseSourceMappingModel();
    }

    getDTO(): any {
        return KnowledgeBaseSourceMappingDto;
    }

    getModuleName(): string {
        return 'Knowledge Base';
    }

    override transformModel(model: KnowledgeBaseSourceMappingModel): KnowledgeBaseSourceMappingModel {
        model.member_id = model.decryptToken?.member_id ?? model.member_id;

        if (model.source_details) {
            // Extract cloud IDs if present in source_details (for Cloud Storage sources)
            model.cloud_provider_id = model.source_details.cloud_provider_id ?? model.source_details.provider_id ?? model.cloud_provider_id;
            model.cloud_secret_id = model.source_details.cloud_secret_id ?? model.source_details.secret_id ?? model.cloud_secret_id;
            model.region_id = model.source_details.region_id ?? model.region_id;

            // Trim trailing spaces from string values in source_details (especially paths)
            Object.keys(model.source_details).forEach(key => {
                if (typeof model.source_details[key] === 'string') {
                    model.source_details[key] = model.source_details[key].trim();
                }
            });
        }

        return model;
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const queryBuilder = this.entity
                .createQueryBuilder("sourceMapping")
                .leftJoinAndSelect(KnowledgeBaseSourceEntity, "sourceType", "sourceType.id = sourceMapping.source_type_id")
                .leftJoinAndSelect(CloudProviderEntity, "cloudProvider", "cloudProvider.id = sourceMapping.cloud_provider_id")
                .leftJoinAndSelect(CloudSecretsEntity, "cloudSecret", "cloudSecret.id = sourceMapping.cloud_secret_id")
                .leftJoinAndSelect(MembersEntity, "member", "member.id = sourceMapping.member_id")
                .select([
                    "sourceMapping.id as id",
                    "sourceMapping.knowledge_base_id as knowledge_base_id",
                    "sourceMapping.source_type_id as source_type_id",
                    "sourceType.name as source_type_name",
                    "sourceType.type as source_type",
                    "sourceType.icon as source_type_icon",
                    "sourceMapping.cloud_provider_id as cloud_provider_id",
                    "cloudProvider.name as cloud_provider_name",
                    "cloudProvider.cloud_provider_image as cloud_provider_image",
                    "sourceMapping.cloud_secret_id as cloud_secret_id",
                    "cloudSecret.name as cloud_secret_name",
                    "sourceMapping.region_id as region_id",
                    "sourceMapping.source_details as source_details",
                    "sourceMapping.status as status",
                    "sourceMapping.source_status as source_status",
                    "sourceMapping.created_at as created_at",
                    "sourceMapping.modified_at as modified_at",
                    "sourceMapping.member_id as member_id",
                    "member.full_name as user_name",
                    "member.profile_picture as profile_image",
                ]);

            if (param.is_delete !== undefined) {
                queryBuilder.andWhere("sourceMapping.is_delete = :isDelete", { isDelete: param.is_delete });
            } else {
                queryBuilder.andWhere("sourceMapping.is_delete = :isDelete", { isDelete: 0 });
            }

            if (param.knowledge_base_id) {
                queryBuilder.andWhere("sourceMapping.knowledge_base_id = :kbId", { kbId: param.knowledge_base_id });
            }

            if (param.id) {
                queryBuilder.andWhere("sourceMapping.id = :id", { id: param.id });
            }

            if (param.status) {
                queryBuilder.andWhere("sourceMapping.status = :status", { status: param.status });
            }

            queryBuilder.orderBy("sourceMapping.id", "DESC");

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                queryBuilder.offset(offset).limit(param.pageSize);
            }

            const [records, total] = await Promise.all([
                queryBuilder.getRawMany(),
                this.entity.count({
                    where: {
                        is_delete: param.is_delete ?? 0,
                        ...(param.id && { id: param.id }),
                        ...(param.knowledge_base_id && { knowledge_base_id: param.knowledge_base_id }),
                        ...(param.status && { status: param.status }),
                    }
                })
            ]);

            const mappedRecords = await Promise.all(records.map(async (record) => {
                let cloudProviderImage = record.cloud_provider_image;
                if (cloudProviderImage && !cloudProviderImage.startsWith("http")) {
                    try {
                        cloudProviderImage = await this.generateSignedUrl("cloudProviderMedia", record.cloud_provider_id, cloudProviderImage);
                    } catch (_error) {
                        cloudProviderImage = null;
                    }
                }

                let sourceTypeIcon = record.source_type_icon;
                if (sourceTypeIcon && Object.keys(sourceTypeIcon).length > 0 && !sourceTypeIcon.startsWith("http")) {
                    try {
                        sourceTypeIcon = await this.generateSignedUrl("knowledge_base_source", record.source_type_id, sourceTypeIcon);
                    } catch (_error) {
                        sourceTypeIcon = null;
                    }
                }

                let profileImage = record.profile_image;
                if (profileImage && !profileImage.startsWith("http")) {
                    try {
                        profileImage = await this.generateSignedUrl("members", record.member_id, profileImage);
                    } catch (_error) {
                        profileImage = null;
                    }
                }

                return {
                    ...record,
                    cloud_provider_image: cloudProviderImage,
                    source_type_icon: sourceTypeIcon,
                    profile_image: profileImage,
                };
            }));

            return Promise.resolve({
                data: mappedRecords,
                pagination: {
                    total,
                    pageSize: param.pageSize,
                    pageNumber: param.pageNumber,
                },
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private getFriendlySourceName(details: any): string {
        let detailsObj = details;
        if (typeof details === 'string') {
            try {
                detailsObj = JSON.parse(details);
            } catch {
                detailsObj = {};
            }
        }
        if (!detailsObj) detailsObj = {};
        
        // 1. If it's a file upload
        if (detailsObj.file_name || detailsObj.fileName) {
            return detailsObj.file_name || detailsObj.fileName;
        }
        
        // 2. If it's a web/scraping URL
        if (detailsObj.url) {
            return detailsObj.url;
        }

        // 3. If it's a cloud storage bucket
        if (detailsObj.bucket_name || detailsObj.bucketName) {
            return detailsObj.bucket_name || detailsObj.bucketName;
        }

        // 4. If it's a database
        if (detailsObj.db_name || detailsObj.database) {
            return detailsObj.db_name || detailsObj.database;
        }

        // 5. Fallback keys
        const nameCandidate = detailsObj.name || detailsObj.path || detailsObj.source_name || detailsObj.sourceName;
        if (nameCandidate) return nameCandidate;

        return 'Source Details';
    }

    override async createPostProcess(
        result: KnowledgeBaseSourceMappingModel,
        _model: KnowledgeBaseSourceMappingModel,
        _files: any
    ): Promise<KnowledgeBaseSourceMappingModel> {
        try {
            // Check if this is a status-only update from the generic save API
            // Usually, a partial update like status toggle won't include knowledge_base_id
            if (_model.id && !_model.knowledge_base_id && _model.status) {
                await this.updateSourceStatus(result.id, result.status);
                return result;
            }

            const jobService = new KnowledgeBaseJobService();
            const existingJob = await jobService.entity
                .createQueryBuilder('job')
                .where('job.knowledge_base_id = :kbId', { kbId: result.knowledge_base_id })
                .orderBy('job.id', 'DESC')
                .getOne();

            let jobId = undefined;
            if (existingJob) {
                await jobService.entity.update({ id: existingJob.id }, { status: KnowledgeBaseJobStatus.PENDING });
                jobId = existingJob.id;
            }

            const isSource = !(_model as any).isInitialSource;
            await this.triggerKafkaUpdate(result.knowledge_base_id, jobId, result.id, isSource);
            const kb = await KnowledgeBaseEntity.findOneBy({ id: result.knowledge_base_id });
            const member = await MembersEntity.findOneBy({ id: result.member_id! });
            const notificationService = new NotificationService();
            const notification = new NotificationModel();
            notification.module_name = ModuleType.RAG;
            notification.notification_type = NotificationType.ADDED;
            notification.company_id = kb?.company_id!;
            notification.user_id = result.member_id!;
            notification.message = `${member?.full_name} added a new source to Knowledge Base: ${kb?.name}`;
            await notificationService.createRecord(notification, null);

            // Track secret usage
            if (result.cloud_secret_id) {
                CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id, 'Knowledge Base');
            }

            const sourceName = this.getFriendlySourceName(result.source_details);

            // Query source type label dynamically from DB
            let sourceTypeLabel = 'Source';
            if (result.source_type_id) {
                const sourceTypeRecord = await KnowledgeBaseSourceEntity.findOneBy({ id: result.source_type_id });
                if (sourceTypeRecord && sourceTypeRecord.name) {
                    sourceTypeLabel = sourceTypeRecord.name;
                }
            }

            await AuditLogService.log({
                company_id: kb?.company_id!,
                member_id: result.member_id!,
                module: 'Knowledge Base',
                action: 'ADD SOURCE',
                entity_type: 'KnowledgeBaseSourceMappingEntity',
                entity_id: result.id,
                entity_name: sourceName,
                description: `Added ${sourceTypeLabel.toLowerCase()} '${sourceName}' to Knowledge Base '${kb?.name}'`,
                ip_address: '',
            });

            return result;
        } catch (error) {
            console.error('[KbSourceMapping] createPostProcess error:', error);
            return result;
        }
    }

    public async syncNow(id: number, memberId?: number): Promise<any> {
        const source = await this.entity.findOneBy({ id });
        if (!source) throw new Error('Source mapping not found');

        const kb = await KnowledgeBaseEntity.findOneBy({ id: source.knowledge_base_id });
        if (!kb) throw new Error('Knowledge base not found');

        // 1. Create a Job record
        const jobService = new KnowledgeBaseJobService();
        const jobModel = jobService.getModel();
        jobModel.knowledge_base_id = kb.id;
        jobModel.company_id = kb.company_id;
        jobModel.status = KnowledgeBaseJobStatus.PENDING;
        delete (jobModel as any).id;

        const jobRecord = await jobService.createRecord(jobModel, null);

        // 2. Trigger Kafka Update with Job ID and Source Mapping ID (explicitly NOT a source addition, but a sync)
        return this.triggerKafkaUpdate(source.knowledge_base_id, jobRecord.id, source.id, true);
    }

    public async updateSourceStatus(id: number, status: string): Promise<any> {
        const source = await this.entity.findOneBy({ id });
        if (!source) throw new Error('Source mapping not found');

        const kb = await KnowledgeBaseEntity.findOneBy({ id: source.knowledge_base_id });
        if (!kb) throw new Error('Knowledge base not found');

        const isActive = status === 'active';
        let chunksFound = true;

        try {
            await this.callChunkEditStatusApi(id, status, kb.id);
        } catch (error: any) {
            const statusCode = error.response?.status || error.statusCode;
            if (statusCode === 404) {
                chunksFound = false;
            } else {
                throw new Error(`Failed to update source status in Vector DB: ${error.message}`);
            }
        }

        source.status = status;
        await this.entity.save(source);

        if (isActive && !chunksFound) {
            const jobService = new KnowledgeBaseJobService();
            const existingJob = await jobService.entity
                .createQueryBuilder('job')
                .where('job.knowledge_base_id = :kbId', { kbId: kb.id })
                .orderBy('job.id', 'DESC')
                .getOne();

            const jobId = existingJob ? existingJob.id : undefined;

            console.log(`[KbSourceMapping] No chunks found for source ${id}. Triggering Kafka ingestion...`);
            await this.triggerKafkaUpdate(kb.id, jobId, id, true);
        }

        return source;
    }

    private async callChunkEditStatusApi(id: number, status: string, kbId: number): Promise<void> {
        let baseUrl = INFERENCE_API_URL;
        if (!baseUrl.endsWith('/')) {
            baseUrl += '/';
        }

        const url = `${baseUrl}chunk-management/source-status`;

        const payload = { 
            source_mapping_id: id, 
            isActive: status === 'active',
            knowledge_base_id: kbId 
        };

        const encryptedPayload = {
            data: EncryptionAndDecryption.encryption(payload)
        };

        try {
            await axios.post(url, encryptedPayload, {
                headers: {
                    'accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                httpsAgent: new https.Agent({ rejectUnauthorized: false })
            });
        } catch (error: any) {
            console.error('[KbSourceMapping] Error calling chunk management API:', error?.message);
            throw error; // Re-throw to allow status check in updateSourceStatus
        }
    }

    public async buildKafkaPayload(kbId: number, jobId?: number, sourceMappingId?: number, isSource: boolean = false): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Fetch related data for RAG Worker using the inlined logic from KnowledgeBaseService.prepareQueryById
                const enriched = await KnowledgeBaseEntity.createQueryBuilder('kb')
                    .leftJoinAndMapOne('kb.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = kb.source_type_id')
                    .leftJoinAndMapOne('kb.embedding_model_details', EmbeddingModelEntity, 'embeddingModel', 'embeddingModel.id = kb.embedding_model_id')
                    .leftJoinAndMapOne('kb.vector_store_info', KnowledgeBaseVectorStoreEntity, 'vectorStore', 'vectorStore.id = kb.vector_store_id')
                    .leftJoinAndMapOne('kb.cloud_provider_details', CloudProviderEntity, 'cloudProvider', 'cloudProvider.id = kb.cloud_provider_id')
                    .leftJoinAndMapOne('kb.cloud_secret_details', CloudSecretsEntity, 'cloudSecret', 'cloudSecret.id = kb.cloud_secret_id')
                    .leftJoinAndMapOne('kb.region_details', CloudRegionEntity, 'cloudRegion', 'cloudRegion.id = kb.region_id')
                    .leftJoinAndMapOne('kb.member_details', MembersEntity, 'member', 'member.id = kb.member_id')
                    .where('kb.id = :id', { id: kbId })
                    .andWhere('kb.is_delete = 0')
                    .getOne();

                if (!enriched) {
                    console.error(`[KbSourceMapping] buildKafkaPayload: Knowledge Base with ID ${kbId} not found or is deleted.`);
                    return reject('E10065');
                }

                console.log(`[KbSourceMapping] buildKafkaPayload: Found Knowledge Base ${enriched.name} (ID: ${kbId})`);

                const {
                    source_type_details: sourceType,
                    embedding_model_details: embeddingModel,
                    vector_store_info: vectorStore,
                    cloud_provider_details: cloudProvider,
                    cloud_secret_details: cloudSecret,
                    region_details: cloudRegion
                } = enriched as any;

                // Prepare source_details as an array of all active source mappings
                const queryBuilder = KnowledgeBaseSourceMappingEntity.createQueryBuilder('sm')
                    .leftJoinAndMapOne('sm.source_type_details', KnowledgeBaseSourceEntity, 'sourceType', 'sourceType.id = sm.source_type_id')
                    .leftJoinAndMapOne('sm.cloud_provider_details', CloudProviderEntity, 'cloudProvider', 'cloudProvider.id = sm.cloud_provider_id')
                    .leftJoinAndMapOne('sm.cloud_secret_details', CloudSecretsEntity, 'cloudSecret', 'cloudSecret.id = sm.cloud_secret_id')
                    .leftJoinAndMapOne('sm.region_details', CloudRegionEntity, 'cloudRegion', 'cloudRegion.id = sm.region_id')
                    .where('sm.knowledge_base_id = :kbId', { kbId: enriched.id })
                    .andWhere('sm.is_delete = 0');

                if (sourceMappingId) {
                    queryBuilder.andWhere('sm.id = :smId', { smId: sourceMappingId });
                } else {
                    queryBuilder.andWhere('sm.status = :status', { status: 'active' });
                }

                const activeMappings = await queryBuilder.getMany();

                const source_details_array: any[] = [];
                let effectiveSourceTypeId = (enriched as any).source_type_id;
                let effectiveSourceType = sourceType;

                if (activeMappings && activeMappings.length > 0) {
                    for (const mapping of activeMappings) {
                        const rawSourceDetails = mapping.source_details;
                        const smSourceType = (mapping as any).source_type_details;
                        const smCloudProvider = (mapping as any).cloud_provider_details;
                        const smCloudSecret = (mapping as any).cloud_secret_details;
                        const smCloudRegion = (mapping as any).region_details;

                        const sourceDbTypeId = rawSourceDetails?.database_type ?? rawSourceDetails?.databaseType;
                        const sourceDbType = sourceDbTypeId ? (
                            !isNaN(Number(sourceDbTypeId))
                                ? await KnowledgeBaseDatabaseTypeEntity.findOneBy({ id: Number(sourceDbTypeId) })
                                : await KnowledgeBaseDatabaseTypeEntity.findOneBy({ name: sourceDbTypeId })
                        ) : null;

                        const sourceDetailsInput = {
                            ...(rawSourceDetails ?? {}),
                            source_mapping_id: mapping.id,
                            source_type_id: mapping.source_type_id,
                            source_type_name: smSourceType?.name,
                            database_type_name: sourceDbType?.name,
                            provider_name: smCloudProvider?.name,
                            region_name: smCloudRegion?.name,
                            secret: smCloudSecret?.secrets,
                            status: mapping.source_status,
                        };

                        // ['provider_id', 'region_id', 'secret_id'].forEach(key => delete sourceDetailsInput[key]);

                        const filteredDetails = Object.fromEntries(
                            Object.entries(sourceDetailsInput).filter(([_, v]) => v != null)
                        );
                        source_details_array.push(filteredDetails);
                    }
                } else {
                    // Fallback to KB base details if no active mappings found
                    let rawSourceDetails = (enriched as any).source_details;

                    const sourceDbTypeId = rawSourceDetails?.database_type ?? rawSourceDetails?.databaseType;
                    const sourceDbType = sourceDbTypeId ? (
                        !isNaN(Number(sourceDbTypeId))
                            ? await KnowledgeBaseDatabaseTypeEntity.findOneBy({ id: Number(sourceDbTypeId) })
                            : await KnowledgeBaseDatabaseTypeEntity.findOneBy({ name: sourceDbTypeId })
                    ) : null;

                    const sourceDetailsInput = {
                        ...(rawSourceDetails ?? {}),
                        source_mapping_id: sourceMappingId,
                        source_type_name: effectiveSourceType?.name,
                        database_type_name: sourceDbType?.name,
                        provider_name: cloudProvider?.name,
                        region_name: cloudRegion?.name,
                        secret: cloudSecret?.secrets,
                    };

                    ['source_type_id', 'provider_id', 'region_id', 'secret_id'].forEach(key => delete sourceDetailsInput[key]);

                    const filteredDetails = Object.fromEntries(
                        Object.entries(sourceDetailsInput).filter(([_, v]) => v != null)
                    );
                    source_details_array.push(filteredDetails);
                }

                const source_details = source_details_array;

                // Prepare enriched vector_store_details
                const dbTypeId = (enriched as any).vector_store_details?.database_type ?? (enriched as any).vector_store_details?.databaseType;
                const dbType = dbTypeId ? (
                    !isNaN(Number(dbTypeId))
                        ? await KnowledgeBaseDatabaseTypeEntity.findOneBy({ id: Number(dbTypeId) })
                        : await KnowledgeBaseDatabaseTypeEntity.findOneBy({ name: dbTypeId })
                ) : null;

                let dbTypeName = dbType?.name;
                if (dbTypeName?.toLowerCase() === 'yotta infrastructure') {
                    dbTypeName = 'qdrant';
                }

                const vectorStoreDetailsInput = {
                    ...((enriched as any).vector_store_details ?? {}),
                    vector_store_name: vectorStore?.name,
                    database_type_name: dbTypeName,
                };

                if (vectorStoreDetailsInput['DB-Type']?.toLowerCase() === 'yotta infrastructure') {
                    vectorStoreDetailsInput['DB-Type'] = 'qdrant';
                    dbTypeName = 'qdrant';
                    vectorStoreDetailsInput.database_type_name = 'qdrant';
                }

                if (vectorStoreDetailsInput.vector_store_id === 1 || vectorStore?.name?.toLowerCase() === 'yotta infrastructure' || dbTypeName === 'qdrant') {
                    const isYotta = vectorStore?.name?.toLowerCase() === 'yotta infrastructure' || vectorStoreDetailsInput['DB-Type'] === 'qdrant';

                    if (isYotta) {
                        vectorStoreDetailsInput.QDRANT_URL = QDRANT_DB_URL;
                        vectorStoreDetailsInput.region = cloudRegion?.name;
                        vectorStoreDetailsInput.region_id = cloudRegion?.id;
                        vectorStoreDetailsInput.vector_store_id = vectorStore?.id;
                        delete vectorStoreDetailsInput.DB_URL;

                        // If it's yotta infrastructure, strictly only send DB-Type and QDRANT_URL
                        delete vectorStoreDetailsInput['db-api-key'];
                        delete vectorStoreDetailsInput['DB-API-Key'];
                        delete vectorStoreDetailsInput['db-index-name'];
                        delete vectorStoreDetailsInput['DB-Index-Name'];
                    } else {
                        vectorStoreDetailsInput.DB_URL = QDRANT_DB_URL;
                    }
                }
                const vector_store_details = Object.fromEntries(
                    Object.entries(vectorStoreDetailsInput).filter(([_, v]) => v != null)
                );

                // Prepare enriched embedding_details
                const embeddingDetailsInput = {
                    ...((enriched as any).embedding_details ?? {}),
                    embedding_model_name: embeddingModel?.name,
                };
                delete embeddingDetailsInput.embedded_model_id;
                const embedding_details = Object.fromEntries(
                    Object.entries(embeddingDetailsInput).filter(([_, v]) => v != null)
                );
                const kafkaPayload = {
                    knowledge_base_id: enriched.id,
                    org_id: (enriched as any).company_id,
                    member_id: (enriched as any).member_id,
                    name: (enriched as any).name,
                    source_type_id: effectiveSourceTypeId,
                    source_type_name: effectiveSourceType?.name,
                    chunking_details: (enriched as any).chunking_details,

                    embedding_details,
                    vector_store_details,
                    source_details,
                    job_id: jobId ?? null,
                    is_source: isSource
                };
                resolve(kafkaPayload);
            } catch (error) {
                console.error('KbSourceMapping buildKafkaPayload error:', error);
                reject(error);
            }
        });
    }

    public async triggerKafkaUpdate(kbId: number, jobId?: number, sourceMappingId?: number, isSource: boolean = false): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const kafkaPayload = await this.buildKafkaPayload(kbId, jobId, sourceMappingId, isSource);
                console.log('[KbSourceMapping] triggerKafkaUpdate: Sending payload to Kafka:', JSON.stringify(kafkaPayload, null, 2));
                await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.RAGINIT, kafkaPayload);
                resolve(true);
            } catch (error) {
                console.error('KbSourceMapping triggerKafkaUpdate error:', error);
                reject(error);
            }
        });
    }
}

export default KnowledgeBaseSourceMappingService;
