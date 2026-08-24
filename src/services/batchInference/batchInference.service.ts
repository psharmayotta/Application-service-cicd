import { BatchInferenceEntity } from "../../entities/batchInferenceEntity";
import { BatchInferenceJobEntity } from "../../entities/batchInferenceJobEntity";
import { BatchJobStatus, DatasetStatus } from "../../config";
import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { BatchInferenceModel } from "../../database/repository/batchInference/batchInference.model";
import { BatchInferenceDto } from "../../database/repository/batchInference/batchInference.dto";
import { BatchInferenceJobService } from "./batchInferenceJob.service";
import { BatchInferenceJobModel } from "../../database/repository/batchInferenceJob/batchInferenceJob.model";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { DataSetEntity } from "../../entities/dataSetEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import CloudSecretsService from "../cloudSecrets/cloudSecretsService.service";
import { KAFKAPRODUCERS, ModuleType, ModelModuleType } from "../../config";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import moment from "moment";
import { CDN_LINK } from "../../config";
import AuditLogService from "../auditLog/auditLogService.services";

export class BatchInferenceService extends BaseServices {
    constructor(entity: any = BatchInferenceEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): BatchInferenceModel {
        return new BatchInferenceModel();
    }

    getDTO(): any {
        return BatchInferenceDto;
    }

    getModuleName(): string {
        return "Batch Inference";
    }

    override transformModel(model: BatchInferenceModel): BatchInferenceModel {
        model.member_id = model.decryptToken?.member_id || model.member_id;
        model.company_id = model.decryptToken?.company_id || model.company_id;
        return model;
    }

    override async createPreProcess(model: BatchInferenceModel, files: any): Promise<BatchInferenceModel> {
        if (!model.id) {
            return this.transformModel(model);
        }

        const existing = await BatchInferenceEntity.findOneBy({ id: Number(model.id), is_delete: 0 });
        if (!existing) {
            return Promise.reject('E10001');
        }

        const requestedStatus = Object.prototype.hasOwnProperty.call(model, 'status')
            ? model.status
            : undefined;
        const decryptToken = model.decryptToken;

        Object.assign(model, existing, {
            decryptToken,
            ...(requestedStatus ? { status: requestedStatus } : {}),
        });

        return this.transformModel(model);
    }

    public async buildKafkaPayload(result: BatchInferenceModel): Promise<any> {
        const modelType = result.model_type || "";
        const isTraining = modelType === ModelModuleType.TRAINING;
        const isMyModel = modelType === ModelModuleType.MYMODEL;
        const isPlayground = modelType === ModelModuleType.PLAYGROUND;

        const [
            cloudProvider,
            dataset,
            baseModel,
            trainingRecord,
            customCloudProvider
        ] = await Promise.all([
            result.cloud_provider_id ? CloudProviderEntity.findOneBy({ id: result.cloud_provider_id }) : Promise.resolve(null),
            result.dataset_id ? DataSetEntity.findOneBy({ id: Number(result.dataset_id) }) : Promise.resolve(null),
            (result.base_model_id && !isTraining) ? ModelEntity.findOneBy({ id: result.base_model_id }) : Promise.resolve(null),
            (result.base_model_id && isTraining) ? ModelTrainingEntity.findOneBy({ id: result.base_model_id }) : Promise.resolve(null),
            result.cloud_provider ? CloudProviderEntity.findOneBy({ id: result.cloud_provider }) : Promise.resolve(null),
        ]);

        let modelObj: ModelEntity | null = baseModel;
        if (isTraining && trainingRecord) {
            modelObj = await ModelEntity.findOneBy({ id: trainingRecord.model_id });
        }

        const [
            datasetSecret,
            datasetProvider,
            modelSecret,
            customSecret,
            cloudSecret
        ] = await Promise.all([
            dataset?.cloud_secret_id ? CloudSecretsEntity.findOneBy({ id: dataset.cloud_secret_id }) : Promise.resolve(null),
            dataset?.cloud_service_id ? CloudProviderEntity.findOneBy({ id: dataset.cloud_service_id }) : Promise.resolve(null),
            (modelObj?.cloud_secret_id || result.secret_id) ? CloudSecretsEntity.findOneBy({ id: modelObj?.cloud_secret_id || result.secret_id }) : Promise.resolve(null),
            result.secret_id ? CloudSecretsEntity.findOneBy({ id: result.secret_id }) : Promise.resolve(null),
            result.cloud_secret_id ? CloudSecretsEntity.findOneBy({ id: result.cloud_secret_id }) : Promise.resolve(null)
        ]);

        let effectiveModelClass = result.model_class;
        let effectiveModelPath = result.model_path;

        if (modelObj?.model_class_id) {
            const modelClass = await ModelClassEntity.findOneBy({ id: modelObj.model_class_id });
            if (isTraining || isMyModel || isPlayground) {
                effectiveModelClass = modelClass?.name || "";
            } else {
                effectiveModelClass = modelClass?.name || "";
            }
            effectiveModelPath = modelObj.model_source_repo;
        }

        let modelDeployType = result.model_type || cloudProvider?.name || ModelModuleType.PLAYGROUND;
        if (!result.model_type && cloudProvider?.name === "Q0 Library") {
            modelDeployType = ModelModuleType.PLAYGROUND;
            if (baseModel && baseModel.member_id) {
                modelDeployType = baseModel.training_id ? ModelModuleType.TRAINING : ModelModuleType.MYMODEL;
            }
        }

        return {
            id: result.id,
            name: result.name,
            company_id: result.company_id,
            member_id: result.member_id,
            dataset: {
                id: result.dataset_id,
                name: dataset?.name || null,
                dataset_provider: datasetProvider?.name || null,
                path: dataset?.dataset_path || null,
                secrets: datasetSecret?.secrets
            },
            model_details: {
                base_model_id: result.base_model_id,
                model_deploy_type: modelDeployType,
                model_class: effectiveModelClass,
                ...(result.base_model_id ? {} : { model_path: effectiveModelPath }),
                ...(!result.base_model_id && modelSecret?.secrets ? { secrets: modelSecret.secrets } : {})
            },
            configuration: result.configuration,
            ...(result.cloud_provider ? {
                cloud_provider: result.cloud_provider,
                cloud_provider_name: customCloudProvider?.name || null
            } : {}),
            ...(result.storage_path ? { storage_path: result.storage_path } : {}),
            ...(result.secret_id ? { secret_detail: customSecret?.secrets || null } : {}),
            ...(result.cloud_secret_id ? { cloud_secret_detail: cloudSecret?.secrets || null } : {}),
        };
    }

    private async trackSecretUsage(result: BatchInferenceModel): Promise<void> {
        if (result.secret_id) {
            CloudSecretsService.updateSecretLastUsed(result.secret_id, 'Batch Inference');
        }
        if (result.cloud_secret_id) {
            CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id, 'Batch Inference');
        }
    }

    override async createPostProcess(
        result: BatchInferenceModel,
        model: BatchInferenceModel,
        files: any
    ): Promise<BatchInferenceModel> {
        const startTime = Date.now();
        try {
            const isUpdate = !!model.id;
            const inference = await BatchInferenceEntity.findOneBy({ id: result.id });
            if (inference) {
                // Initialize last_run_at only if it's a new creation
                if (!isUpdate) {
                    inference.last_run_at = moment().utcOffset('+05:30').format('YYYY-MM-DD HH:mm:ss') as any;
                }

                if (inference.is_sync_enabled !== false && inference.sync_frequency && inference.sync_frequency.toLowerCase() !== 'none') {
                    inference.next_run_at = this.calculateNextRun(
                        inference.sync_frequency,
                        inference.sync_time,
                        inference.sync_day
                    );
                } else {
                    inference.next_run_at = null as any;
                }

                await BatchInferenceEntity.save(inference);
                console.log(`[BatchInference] Scheduling updated for inference ${result.id}. Next run: ${inference.next_run_at}`);
            }

            // If it is an update, we only wanted to update the schedule or handle status changes.
            if (isUpdate) {
                console.log(`[BatchInference] Update processed for Inference ID: ${result.id}`);

                // Handle PAUSE logic for the latest job
                if ((model as any).status === BatchJobStatus.PAUSED) {
                    const latestJob = await this.getLatestJobStatusByInferenceId(result.id);
                    if (latestJob) {
                        latestJob.status = BatchJobStatus.PAUSED;
                        await BatchInferenceJobEntity.save(latestJob);

                        await AuditLogService.log({
                            company_id: result.company_id,
                            member_id: model.decryptToken?.member_id || result.member_id,
                            module: this.getModuleName(),
                            action: 'PAUSE',
                            entity_type: 'BatchInferenceEntity',
                            entity_id: result.id,
                            entity_name: result.name,
                            description: `Batch inference paused`,
                            ip_address: '',
                        });

                        const payload = await this.buildKafkaPayload((result) as any);
                        payload.job_id = latestJob.id;
                        payload.triggered_at = new Date().toISOString();
                        payload.type = 'PAUSE';
                        await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.BATCH_INFERENCE, payload);
                        console.log(`[BatchInference] Kafka PAUSE message dispatched for Latest Job ID: ${latestJob.id}`);
                    } else {
                        console.warn(`[BatchInference] No latest job found to pause for Inference ID: ${result.id}`);
                    }
                }

                return result;
            }

            // --------- INITIALIZATION (CREATE ONLY) ---------
            const activeConfiguration = result.configuration;
            const jobService = new BatchInferenceJobService();
            const jobModel = new BatchInferenceJobModel();
            jobModel.inference_id = result.id;
            jobModel.result = null;
            jobModel.configuration = activeConfiguration;

            let hasFailedDataset = false;
            let hasPendingDataset = false;

            if (result.dataset_id) {
                const dataset = await DataSetEntity.findOneBy({ id: Number(result.dataset_id) });
                if (dataset) {
                    if (dataset.status === DatasetStatus.FAILED) {
                        hasFailedDataset = true;
                    } else if (!dataset.download_status) {
                        hasPendingDataset = true;
                    }
                }
            }

            let resolvedJobId: number;
            let shouldDispatchJob = false;
            let notificationMessage = `Batch inference "${model.name}" created. Initial job is now processing.`;

            if (hasFailedDataset) {
                jobModel.status = BatchJobStatus.FAILED;
                const jobResponse = await jobService.createRecord(jobModel, null);
                resolvedJobId = jobResponse.id;
                notificationMessage = `Batch inference "${model.name}" created, but dataset download failed.`;
                console.log(`[BatchInference] Dataset failed. Job record created in FAILED status: ${resolvedJobId}`);
            } else if (hasPendingDataset) {
                jobModel.status = BatchJobStatus.QUEUED;
                const jobResponse = await jobService.createRecord(jobModel, null);
                resolvedJobId = jobResponse.id;
                notificationMessage = `Batch inference "${model.name}" created. Initial job is queued waiting for dataset download.`;
                console.log(`[BatchInference] Dataset still downloading. Job record created in QUEUED status: ${resolvedJobId}`);
            } else {
                jobModel.status = BatchJobStatus.PENDING;
                const jobResponse = await jobService.createRecord(jobModel, null);
                resolvedJobId = jobResponse.id;
                shouldDispatchJob = true;
                console.log(`[BatchInference] Job record created via JobService with ID: ${resolvedJobId}`);
            }

            await AuditLogService.log({
                company_id: result.company_id,
                member_id: model.decryptToken?.member_id || result.member_id,
                module: this.getModuleName(),
                action: 'CREATE',
                entity_type: 'BatchInferenceEntity',
                entity_id: result.id,
                entity_name: result.name,
                description: `Created batch inference`,
                ip_address: '',
            });

            if (shouldDispatchJob) {
                const payload = await this.buildKafkaPayload(result);
                payload.job_id = resolvedJobId;
                payload.triggered_at = new Date().toISOString();
                payload.type = 'CREATE';

                await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.BATCH_INFERENCE, payload);
                console.log(`[BatchInference] Kafka message dispatched for Job ID: ${resolvedJobId}`);
            }

            // 4. User Notification
            const notificationService = new NotificationService();
            const notification = new NotificationModel();
            notification.module_name = ModuleType.BATCH_INFERENCE;
            notification.notification_type = 'Created';
            notification.is_readed = false;
            notification.company_id = model.company_id;
            notification.user_id = model.member_id;
            notification.message = notificationMessage;
            await notificationService.createRecord(notification, null);

            const duration = Date.now() - startTime;
            console.log(`[BatchInference] Post-process completed successfully for ID: ${result.id} in ${duration}ms`);

            // Track secret usage
            await this.trackSecretUsage(result);

            if (hasFailedDataset) {
                await AuditLogService.logFailureIncident({
                    company_id: result.company_id,
                    member_id: result.member_id,
                    module: this.getModuleName(),
                    entity_type: 'BatchInferenceEntity',
                    entity_id: result.id,
                    entity_name: result.name,
                    description: `Batch inference ${result.name} failed`,
                    reason: 'Dataset download failed',
                    metadata: {
                        job_id: resolvedJobId,
                        dataset_id: result.dataset_id,
                        failure_source: 'dataset',
                    },
                });
            }

            return result;
        } catch (error: any) {
            // Senior implementation: catch, log with context, and rethrow to allow base handlers to react
            console.error(`[BatchInference][CRITICAL] Post-process failed for ID: ${result.id}`, {
                error: error.message,
                stack: error.stack,
                inferenceId: result.id
            });
            throw error;
        }
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const queryBuilder = this.entity
                .createQueryBuilder("batch")
                .leftJoin(MembersEntity, "members", "members.id = batch.member_id")
                .leftJoin(CloudProviderEntity, "provider", "provider.id = batch.cloud_provider_id")
                .leftJoin(DataSetEntity, "dataset", "dataset.id = batch.dataset_id")
                .leftJoin(BatchInferenceJobEntity, "latestJob", "latestJob.id = (SELECT MAX(id) FROM batch_inference.batch_inference_job WHERE inference_id = batch.id)")
                .select([
                    "batch.id AS id",
                    "batch.name AS name",
                    "batch.created_at AS created_at",
                    "batch.dataset_id AS dataset_id",
                    "batch.member_id AS member_id",
                    "batch.cloud_provider_id AS cloud_provider_id",
                    "members.full_name AS member_name",
                    "members.profile_picture AS member_image",
                    "provider.name AS source_name",
                    "provider.cloud_provider_image AS source_image",
                    "dataset.name AS dataset_name",
                    "batch.is_active AS is_active",
                    "latestJob.status AS status"
                ])
                .where("batch.is_delete = :isDelete", { isDelete: param.is_delete ?? 0 })
                .orderBy("batch.id", "DESC");

            if (param.company_id) {
                queryBuilder.andWhere("batch.company_id = :companyId", { companyId: param.company_id });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                queryBuilder.andWhere(
                    "(LOWER(batch.name) LIKE :search)",
                    { search: searchText }
                );
            }

            if (param.status) {
                const statuses = Array.isArray(param.status) ? param.status : [param.status];
                queryBuilder.andWhere("UPPER(latestJob.status) IN (:...statuses)", { statuses: statuses.map((s: string) => s.toUpperCase()) });
            }

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                queryBuilder.offset(offset);
                queryBuilder.limit(param.pageSize);
            }

            const countQuery = this.entity
                .createQueryBuilder("batch")
                .leftJoin(BatchInferenceJobEntity, "latestJob", "latestJob.id = (SELECT MAX(id) FROM batch_inference.batch_inference_job WHERE inference_id = batch.id)")
                .where("batch.is_delete = :isDelete", { isDelete: param.is_delete ?? 0 });

            if (param.company_id) {
                countQuery.andWhere("batch.company_id = :companyId", { companyId: param.company_id });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                countQuery.andWhere(
                    "(LOWER(batch.name) LIKE :search)",
                    { search: searchText }
                );
            }

            if (param.status) {
                const statuses = Array.isArray(param.status) ? param.status : [param.status];
                countQuery.andWhere("UPPER(latestJob.status) IN (:...statuses)", { statuses: statuses.map((s: string) => s.toUpperCase()) });
            }

            const [records, total] = await Promise.all([
                queryBuilder.getRawMany(),
                countQuery.getCount(),
            ]);

            const formattedRecords = await Promise.all(records.map(async record => {
                let memberImage = record.member_image;
                if (memberImage && !memberImage.startsWith('http')) {
                    try {
                        memberImage = await this.generateSignedUrl('members', record.member_id, record.member_image);
                    } catch (e) {
                        memberImage = null;
                    }
                }

                let sourceImage = record.source_image;
                if (sourceImage && !sourceImage.startsWith('http')) {
                    try {
                        sourceImage = await this.generateSignedUrl('cloudProviderMedia', record.cloud_provider_id, record.source_image);
                    } catch (e) {
                        sourceImage = null;
                    }
                }

                return {
                    id: record.id,
                    name: record.name,
                    source_name: record.source_name,
                    source_image: sourceImage,
                    dataset_name: record.dataset_name,
                    member_name: record.member_name,
                    member_image: memberImage,
                    status: record.status || "PENDING",
                    dataset_id: record.dataset_id,
                    is_active: record.is_active,
                    created_at: record.created_at
                };
            }));

            return {
                data: formattedRecords,
                pagination: {
                    total,
                    pageSize: param.pageSize,
                    pageNumber: param.pageNumber,
                },
            };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: any): Promise<any> {
        try {
            if (!param.id) return Promise.reject('E10006');

            const record = await this.entity
                .createQueryBuilder("batch")
                .leftJoinAndSelect(MembersEntity, "members", "members.id = batch.member_id")
                .leftJoinAndSelect(CloudProviderEntity, "provider", "provider.id = batch.cloud_provider_id")
                .leftJoinAndSelect(CloudProviderEntity, "cloudProvider", "cloudProvider.id = batch.cloud_provider")
                .leftJoinAndSelect(DataSetEntity, "dataset", "dataset.id = batch.dataset_id")
                .leftJoinAndSelect(ModelEntity, "baseModel", "baseModel.id = batch.base_model_id")
                .leftJoinAndSelect(ModelClassEntity, "modelClass", "modelClass.id = baseModel.model_class_id")
                .select([
                    "batch.id AS id",
                    "batch.name AS name",
                    "batch.description AS description",
                    "batch.cloud_provider_id AS cloud_provider_id",
                    "batch.dataset_id AS dataset_id",
                    "batch.base_model_id AS base_model_id",
                    "batch.model_class AS model_class",
                    "batch.model_path AS model_path",
                    "batch.configuration AS configuration",
                    "batch.created_at AS created_at",
                    "members.full_name AS created_by",
                    "provider.name AS provider_name",
                    "provider.cloud_provider_image AS provider_image",
                    "dataset.name AS dataset_name",
                    "dataset.yotta_bucket_path AS dataset_path",
                    "baseModel.name AS base_model_name",
                    "baseModel.model_source_repo AS base_model_path",
                    "modelClass.name AS model_class_name",
                    "modelClass.abb AS model_class_abb",
                    "batch.is_active AS is_active",
                    "batch.is_sync_enabled AS is_sync_enabled",
                    "cloudProvider.name AS cloud_provider_name",
                    "batch.storage_path AS storage_path",
                    "batch.cloud_secret_id AS cloud_secret_id"
                ])
                .where("batch.id = :id", { id: param.id })
                .andWhere("batch.is_delete = 0")
                .getRawOne();

            if (!record) return Promise.reject('E10001');

            const latestJob = await this.getLatestJobStatusByInferenceId(record.id);

            return {
                ...record,
                effective_model_class: record.model_class_abb || record.model_class_name || record.model_class,
                effective_model_path: record.base_model_path || record.model_path,
                latest_job: latestJob ? {
                    id: latestJob.id,
                    status: latestJob.status,
                    result: latestJob.result,
                    report_path: latestJob.report_path,
                    created_at: latestJob.created_at,
                    progress: latestJob.progress,
                    logs: latestJob.logs
                } : null
            };
        } catch (error) {
            return Promise.reject(error);
        }
    }


    /**
     * Creates an execution run (Job) for a configuration.
     */
    async runInference(inferenceId: number) {
        const inference = await (this.entity as typeof BatchInferenceEntity).findOneBy({ id: inferenceId });
        if (!inference) throw new Error("Batch inference configuration not found");

        const previousJob = await this.getLatestJobStatusByInferenceId(inferenceId);
        const isResume = previousJob?.status === BatchJobStatus.PAUSED;

        const jobService = new BatchInferenceJobService();
        const jobModel = new BatchInferenceJobModel();
        jobModel.inference_id = inferenceId;
        jobModel.result = null;
        jobModel.configuration = inference.configuration;

        let hasFailedDataset = false;
        let hasPendingDataset = false;

        if (inference.dataset_id) {
            const dataset = await DataSetEntity.findOneBy({ id: Number(inference.dataset_id) });
            if (dataset) {
                if (dataset.status === DatasetStatus.FAILED) {
                    hasFailedDataset = true;
                } else if (!dataset.download_status) {
                    hasPendingDataset = true;
                }
            }
        }

        if (hasFailedDataset) {
            jobModel.status = BatchJobStatus.FAILED;
            const job = await jobService.createRecord(jobModel, null);
            return job;
        } else if (hasPendingDataset) {
            jobModel.status = BatchJobStatus.QUEUED;
            const job = await jobService.createRecord(jobModel, null);
            return job;
        } else {
            jobModel.status = BatchJobStatus.PENDING;
            const job = await jobService.createRecord(jobModel, null);

            // Update inference run times
            inference.last_run_at = moment().utcOffset('+05:30').format('YYYY-MM-DD HH:mm:ss') as any;
            if (inference.is_sync_enabled !== false && inference.sync_frequency && inference.sync_frequency !== 'none') {
                inference.next_run_at = this.calculateNextRun(
                    inference.sync_frequency,
                    inference.sync_time,
                    inference.sync_day
                );
            } else {
                inference.next_run_at = null as any;
            }
            await (this.entity as typeof BatchInferenceEntity).save(inference);

            if (isResume) {
                await AuditLogService.log({
                    company_id: inference.company_id,
                    member_id: inference.member_id,
                    module: this.getModuleName(),
                    action: 'RESUME',
                    entity_type: 'BatchInferenceEntity',
                    entity_id: inference.id,
                    entity_name: inference.name,
                    description: `Batch inference resumed`,
                    ip_address: '',
                });
            }

            // Trigger Kafka - Building full payload to help downstream
            const kafkaPayload = await this.buildKafkaPayload(inference as any);
            const payloadWithJob = {
                ...kafkaPayload,
                job_id: job.id,
                type: 'CREATE'
            };

            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.BATCH_INFERENCE, payloadWithJob);

            return job;
        }
    }

    public async initiateJob(job: BatchInferenceJobEntity, inference: BatchInferenceEntity) {
        // Update job status to PENDING
        job.status = BatchJobStatus.PENDING;
        await BatchInferenceJobEntity.save(job);

        // Update inference run times
        inference.last_run_at = moment().utcOffset('+05:30').format('YYYY-MM-DD HH:mm:ss') as any;
        if (inference.is_sync_enabled !== false && inference.sync_frequency && inference.sync_frequency !== 'none') {
            inference.next_run_at = this.calculateNextRun(
                inference.sync_frequency,
                inference.sync_time,
                inference.sync_day
            );
        } else {
            inference.next_run_at = null as any;
        }
        await BatchInferenceEntity.save(inference);

        // Trigger Kafka
        const kafkaPayload = await this.buildKafkaPayload(inference as any);
        const payloadWithJob = {
            ...kafkaPayload,
            job_id: job.id,
            type: 'CREATE'
        };

        await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.BATCH_INFERENCE, payloadWithJob);
    }

    private calculateNextRun(frequency: string, syncTime?: string | null, syncDay?: string | null): any {
        const now = moment().utcOffset('+05:30');
        switch (frequency.toLowerCase()) {
            case 'hourly': return now.add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
            case 'daily': {
                if (syncTime) {
                    const [hourStr, minStr] = syncTime.split(':');
                    const targetHour = parseInt(hourStr, 10) || 0;
                    const targetMin = parseInt(minStr, 10) || 0;

                    const runTime = moment().utcOffset('+05:30').set({ hour: targetHour, minute: targetMin, second: 0, millisecond: 0 });
                    if (runTime.isSameOrBefore(now)) {
                        runTime.add(1, 'day');
                    }
                    return runTime.format('YYYY-MM-DD HH:mm:ss');
                }
                return now.add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
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
                    return runTime.format('YYYY-MM-DD HH:mm:ss');
                }
                return now.add(1, 'week').format('YYYY-MM-DD HH:mm:ss');
            }
            case 'monthly': return now.add(1, 'month').format('YYYY-MM-DD HH:mm:ss');
            default:
                // If it's a numeric string, treat as minutes
                if (!isNaN(parseInt(frequency))) {
                    return now.add(parseInt(frequency), 'minutes').format('YYYY-MM-DD HH:mm:ss');
                }
                return null as any;
        }
    }

    async syncNow(id: number) {
        return await this.runInference(id);
    }

    /**
     * Maps incoming Kafka status strings to valid BatchJobStatus enum values.
     * External services may send free-form statuses like 'Batch Inferencing',
     * which must be normalized before persisting to the enum column.
     */
    private normalizeBatchJobStatus(rawStatus: string): BatchJobStatus {
        const upper = rawStatus.toUpperCase().trim();

        // Direct enum match
        if (Object.values(BatchJobStatus).includes(upper as BatchJobStatus)) {
            return upper as BatchJobStatus;
        }

        // Map known external status strings to valid enum values
        const statusMap: Record<string, BatchJobStatus> = {
            'BATCH INFERENCING': BatchJobStatus.RUNNING,
            'BATCH_INFERENCING': BatchJobStatus.RUNNING,
            'INFERENCING': BatchJobStatus.RUNNING,
            'PROCESSING': BatchJobStatus.RUNNING,
            'IN_PROGRESS': BatchJobStatus.RUNNING,
            'IN PROGRESS': BatchJobStatus.RUNNING,
            'STARTED': BatchJobStatus.RUNNING,
            'QUEUED': BatchJobStatus.PENDING,
            'SUCCESS': BatchJobStatus.COMPLETED,
            'DONE': BatchJobStatus.COMPLETED,
            'ERROR': BatchJobStatus.FAILED,
            'CANCELED': BatchJobStatus.CANCELLED,
        };

        const mapped = statusMap[upper];
        if (mapped) {
            console.log(`[BatchService] Mapped incoming status '${rawStatus}' -> '${mapped}'`);
            return mapped;
        }

        // Fallback: log a warning and default to RUNNING for unrecognized active statuses
        console.warn(`[BatchService] Unrecognized status '${rawStatus}', defaulting to RUNNING`);
        return BatchJobStatus.RUNNING;
    }

    /**
     * Updates job status from Kafka consumer
     */
    async updateJobStatus(payload: any) {
        const jobIdRaw = payload.job_id || payload.batch_job_id;
        if (!jobIdRaw || jobIdRaw === 'unknown-batch-job' || isNaN(parseInt(jobIdRaw as any))) {
            console.error(`[BatchService] Invalid Job ID in status payload:`, jobIdRaw);
            return;
        }

        const parsedJobId = parseInt(jobIdRaw as string);
        const { status, result, report_path } = payload;

        const job = await BatchInferenceJobEntity.findOneBy({ id: parsedJobId });
        if (!job) {
            console.error(`[BatchService] Job ${parsedJobId} not found for status update`);
            return;
        }
        const previousStatus = job.status;

        const inference = await BatchInferenceEntity.findOneBy({ id: job.inference_id });
        if (!inference) {
            console.error(`[BatchService] Associated inference record ${job.inference_id} not found for job ${parsedJobId}`);
            return;
        }

        if (status) job.status = this.normalizeBatchJobStatus(status);

        if (payload.progress) {
            job.progress = payload.progress;
        }

        // Build log line to append to history
        const logParts: string[] = [];
        const logTimestamp = payload.timestamp || new Date().toISOString();
        logParts.push(`[${logTimestamp}]`);
        if (status || payload.status) {
            logParts.push(`Status: ${status || payload.status}`);
        }
        if (payload.progress) {
            const { processed, total, percentage } = payload.progress;
            logParts.push(`Progress: ${percentage}% (${processed}/${total})`);
        }
        if (payload.current_sample) {
            logParts.push(`Sample: ${payload.current_sample}`);
        }
        if (payload.pod_name) {
            logParts.push(`Pod: ${payload.pod_name}`);
        }
        const incomingLog = payload.logs || payload.log || payload.message || payload.error_message;
        if (incomingLog) {
            logParts.push(`Detail: ${incomingLog}`);
        }

        const logLine = logParts.join(' | ');
        job.logs = job.logs ? `${job.logs}\n${logLine}` : logLine;

        // If the payload specifies a dedicated result object, store it
        if (result !== undefined) {
            // result here is usually the summary info ({ processed_records, etc. })
            if (!job.result || typeof job.result !== 'object' || Array.isArray(job.result)) {
                job.result = { summary: result, records: [] };
            } else {
                job.result.summary = result;
            }
        }

        if (report_path) job.report_path = report_path;

        await BatchInferenceJobEntity.save(job);
        console.log(`[BatchService] Job ${parsedJobId} status updated to ${job.status} (raw: ${status})`);

        if (job.status === BatchJobStatus.COMPLETED && previousStatus !== BatchJobStatus.COMPLETED) {
            await AuditLogService.log({
                company_id: inference.company_id,
                member_id: inference.member_id,
                module: this.getModuleName(),
                action: 'COMPLETED',
                entity_type: 'BatchInferenceEntity',
                entity_id: inference.id,
                entity_name: inference.name,
                description: `Batch inference completed`,
                metadata: {
                    job_id: job.id,
                    previous_status: previousStatus,
                    current_status: job.status,
                },
                ip_address: '',
            });
        }

        if (job.status === BatchJobStatus.FAILED) {
            inference.is_sync_enabled = false;
            await BatchInferenceEntity.save(inference);
        }

        // WebSocket push to inform frontend about the progress
        // Build payload directly from already-fetched records instead of prepareQueryById
        // which can fail due to complex join queries
        const wsPayload: any = {
            id: inference.id,
            name: inference.name,
            latest_job: {
                id: job.id,
                status: job.status,
                result: job.result,
                report_path: job.report_path,
                created_at: job.created_at,
            },
        };

        // Include progress info from the Kafka payload if available
        if (payload.progress) {
            wsPayload.latest_job.progress = payload.progress;
        }
        if (payload.current_sample) {
            wsPayload.latest_job.current_sample = payload.current_sample;
        }

        await WebSocketService.pushMessageToCompany(inference.company_id.toString(), {
            module: ModuleType.BATCH_INFERENCE,
            entity: wsPayload,
        });

        if (job.status === BatchJobStatus.COMPLETED || job.status === BatchJobStatus.FAILED) {
            if (job.status === BatchJobStatus.COMPLETED) {
                const startTime = new Date(job.created_at).getTime();
                const endTime = new Date().getTime();
                const diffSeconds = (endTime - startTime) / 1000;
                job.execution_time = parseFloat(diffSeconds.toFixed(2));
                await BatchInferenceJobEntity.save(job);

                const kafkaPayload = {
                    module: ModuleType.BATCH_INFERENCE,
                    member_id: inference.member_id,
                    company_id: inference.company_id,
                    entity_id: job.id,
                    request: {
                        job_id: job.id,
                        time_taken: job.execution_time,
                    }
                };
                await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, kafkaPayload);
            }

            const notificationService = new NotificationService();
            const notification = new NotificationModel();
            notification.module_name = ModuleType.BATCH_INFERENCE;
            notification.notification_type = 'Updated'
            notification.is_readed = false;
            notification.company_id = inference.company_id;
            notification.user_id = inference.member_id;
            notification.message = `Batch inference job "${inference.name}" ${status}.`;
            await notificationService.createRecord(notification, null);
        }

        if (job.status === BatchJobStatus.FAILED && previousStatus !== BatchJobStatus.FAILED) {
            await AuditLogService.logFailureIncident({
                company_id: inference.company_id,
                member_id: inference.member_id,
                module: this.getModuleName(),
                entity_type: 'BatchInferenceEntity',
                entity_id: inference.id,
                entity_name: inference.name,
                description: `Batch inference ${inference.name} failed`,
                reason: incomingLog || result || payload,
                metadata: {
                    job_id: job.id,
                    previous_status: previousStatus,
                    current_status: job.status,
                    kafka_payload: payload,
                },
            });
        }
    }

    /**
     * Saves individual record result or final job summary from Kafka consumer
     */
    async saveJobResult(payload: any) {
        const jobIdRaw = payload.job_id || payload.batch_job_id;
        if (!jobIdRaw || jobIdRaw === 'unknown-batch-job' || isNaN(parseInt(jobIdRaw))) {
            console.error(`[BatchService] Invalid Job ID in result payload:`, jobIdRaw);
            return;
        }

        const parsedJobId = parseInt(jobIdRaw as string);
        const { record_id, input, output, status, error_message, result } = payload;

        const job = await BatchInferenceJobEntity.findOneBy({ id: parsedJobId });
        if (!job) {
            console.error(`[BatchService] Job ${parsedJobId} not found for result save`);
            return;
        }

        if (status) job.status = status;

        // If it's a final job summary (has 'result' object with stats)
        if (result && typeof result === 'object' && !record_id) {
            job.result = {
                summary: result,
                records: job.result?.records || []
            };
            console.log(`[BatchService] Stored final summary for job ${parsedJobId}`);
        }
        // If it's an individual record result
        else if (record_id) {
            if (!job.result || typeof job.result !== 'object' || Array.isArray(job.result)) {
                job.result = { records: [], summary: {} };
            }
            if (!job.result.records) {
                job.result.records = [];
            }

            job.result.records.push({
                record_id,
                input,
                output,
                status,
                error_message,
                timestamp: new Date().toISOString()
            });
            console.log(`[BatchService] Added result for record ${record_id} to job ${parsedJobId}`);
        }

        await BatchInferenceJobEntity.save(job);

        // Fetch associated inference record to get company_id for WebSocket push
        const inference = await BatchInferenceEntity.findOneBy({ id: job.inference_id });
        if (inference) {
            const wsPayload: any = {
                id: inference.id,
                name: inference.name,
                latest_job: {
                    id: job.id,
                    status: job.status,
                    result: job.result,
                    report_path: job.report_path,
                    created_at: job.created_at,
                },
            };
            await WebSocketService.pushMessageToCompany(inference.company_id.toString(), {
                module: ModuleType.BATCH_INFERENCE,
                entity: wsPayload,
            });
        }
    }

    async getJobStatus(jobId: number) {
        const job = await BatchInferenceJobEntity.findOneBy({ id: jobId });
        if (!job) throw new Error("Job not found");
        return job;
    }

    /**
     * Get the latest run status for an inference config.
     */
    async getLatestJobStatusByInferenceId(inferenceId: number) {
        const job = await BatchInferenceJobEntity.findOne({
            where: { inference_id: inferenceId },
            order: { created_at: "DESC" }
        });
        return job;
    }

    async getResults(jobId: number, page: number = 1, size: number = 10) {
        const job = await BatchInferenceJobEntity.findOneBy({ id: jobId });
        if (!job || !job.result || !job.result.records || !Array.isArray(job.result.records)) {
            return {
                results: [],
                total: 0,
                page,
                size,
            };
        }

        const allResults = job.result.records;
        const total = allResults.length;
        const startIndex = (page - 1) * size;
        const results = allResults.slice(startIndex, startIndex + size);

        return {
            results,
            total,
            page,
            size,
            summary: job.result.summary || {}
        };
    }

    async retryJob(jobId: number) {
        const job = await BatchInferenceJobEntity.findOneBy({ id: jobId });
        if (!job) throw new Error("Job not found");

        if (job.status !== BatchJobStatus.FAILED && job.status !== BatchJobStatus.CANCELLED) {
            throw new Error("Only failed or cancelled jobs can be retried");
        }

        job.status = BatchJobStatus.PENDING;
        await BatchInferenceJobEntity.save(job);
        return job;
    }

    async cancelJob(jobId: number) {
        const job = await BatchInferenceJobEntity.findOneBy({ id: jobId });
        if (!job) throw new Error("Job not found");

        if (job.status === BatchJobStatus.COMPLETED || job.status === BatchJobStatus.FAILED) {
            throw new Error("Job already finished");
        }

        job.status = BatchJobStatus.CANCELLED;
        await BatchInferenceJobEntity.save(job);

        try {
            const inference = await BatchInferenceEntity.findOneBy({ id: job.inference_id });
            if (inference) {
                await AuditLogService.log({
                    company_id: inference.company_id,
                    member_id: inference.member_id,
                    module: this.getModuleName(),
                    action: 'UPDATE',
                    entity_type: 'BatchInferenceEntity',
                    entity_id: inference.id,
                    entity_name: inference.name,
                    description: `Batch inference cancelled`,
                    ip_address: '',
                });
            }
        } catch (e) { }

        return job;
    }

    async getSampleDatasetUrl(param: any): Promise<any> {
        if (!param.id) return Promise.reject('E10006');

        const model = await ModelEntity.findOneBy({ id: param.id, is_delete: 0 });
        if (!model) return Promise.reject('E10029');

        let s3Path = model.sample_dataset_path;

        if (param.model_type === ModelModuleType.PLAYGROUND) {
            s3Path = model.sample_dataset_path;
        } else if (param.model_type === ModelModuleType.MYMODEL) {
            const fallbackModel = await ModelEntity.createQueryBuilder("model")
                .where("model.model_class_id = :classId", { classId: model.model_class_id })
                .andWhere("model.sample_dataset_path IS NOT NULL")
                .andWhere("model.is_delete = 0")
                .orderBy("model.id", "ASC")
                .getOne();

            if (fallbackModel) {
                s3Path = fallbackModel.sample_dataset_path;
            }
        } else {
            const fallbackModel = await ModelEntity.createQueryBuilder("model")
                .where("model.model_class_id = :classId", { classId: param.model_class })
                .andWhere("model.sample_dataset_path IS NOT NULL")
                .andWhere("model.is_delete = 0")
                .orderBy("model.id", "ASC")
                .getOne();

            if (fallbackModel) {
                s3Path = fallbackModel.sample_dataset_path;
            }
        }

        if (!s3Path) return Promise.reject('E10001');

        const relativePath = s3Path.replace(/^s3:\/\/[^\/]+\//, "");
        const cdnUrl = `${CDN_LINK}${relativePath}`;
        return { url: cdnUrl };
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
                        entity_type: 'BatchInferenceEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Deleted batch inference`,
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
