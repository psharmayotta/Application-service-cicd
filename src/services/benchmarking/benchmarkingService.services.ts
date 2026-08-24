import { In } from "typeorm";
import { BenchmarkingStatus, BenchmarkingType, DatasetStatus, KAFKAPRODUCERS, ModelBenchmarkingStatus, ModelModuleType, ModuleType } from "../../config";
import { AwsService } from "../../core/AwsService";
import { BenchmarkingDto } from "../../database/repository/benchmarking/benchmarking.dto";
import { BenchmarkingModel } from "../../database/repository/benchmarking/benchmarking.model";
import { BenchmarkingEntity } from "../../entities/benchmarkingEntity";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import CloudSecretsService from "../cloudSecrets/cloudSecretsService.service";
import { DataSetEntity } from "../../entities/dataSetEntity";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import { BenchmarkingDatasetEntity } from "../../entities/benchmarkingDatasetEntity";
import { EvaluationTaskEntity } from "../../entities/evaluationTaskEntity";
import { KnowledgeBaseEntity } from "../../entities/knowledgeBaseEntity";
import KnowledgeBaseSourceMappingService from "../knowledgeBase/knowledgeBaseSourceMappingService.services";
import { KnowledgeBaseJobService } from "../knowledgeBase/knowledgeBaseJobService.services";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { BaseServices } from "../baseService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { NotificationService } from "../notification/notificationService.services";
import { BenchmarkingFilter } from "../../core/InferParams";
import AuditLogService from "../auditLog/auditLogService.services";

class BenchmarkingService extends BaseServices {
    constructor(entity: any = BenchmarkingEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): BenchmarkingModel {
        return new BenchmarkingModel();
    }

    getDTO(): any {
        return BenchmarkingDto;
    }

    getModuleName(): string {
        return "Benchmarking";
    }

    private getCreationTypeLabel(type: string): string {
        const normalizedType = String(type || '').trim().toLowerCase();
        const labels: Record<string, string> = {
            [BenchmarkingType.MODEL.toLowerCase()]: 'Model to Model',
            model_comparison: 'Model to Model',
            [BenchmarkingType.HARDWARE.toLowerCase()]: 'Hardware to Hardware',
            hardware: 'Hardware to Hardware',
            [BenchmarkingType.RAG.toLowerCase()]: 'RAG Benchmarking',
            rag: 'RAG Benchmarking',
            [BenchmarkingType.MODEL_EVALUATION.toLowerCase()]: 'Model Evaluation',
            model_evaluation: 'Model Evaluation',
        };

        return labels[normalizedType] || type;
    }

    private async buildKafkaPayload(result: BenchmarkingModel): Promise<any> {
        const datasetIds = Array.isArray(result.dataset_id) ? result.dataset_id : [];
        const customDatasetIds = datasetIds.filter((d: any) => d.type === "custom_dataset").map((d: any) => d.id);
        const libraryDatasetIds = datasetIds.filter((d: any) => d.type === "dataset_library").map((d: any) => d.id);

        const [
            creator,
            modelCategory,
            modelOneSource,
            modelTwoSource,
            modelClass1,
            modelClass2,
            baseModel,
            accelerator,
            hardwareOne,
            hardwareTwo,
            aiModel,
            baseModel2,
            cloudSecret1,
            cloudSecret2,
            evaluationTask,
            customDatasets,
            libraryDatasets,
        ] = await Promise.all([
            result.member_id ? MembersEntity.findOneBy({ id: result.member_id }) : Promise.resolve(null),
            result.model_category_id ? ModelCategoryEntity.findOneBy({ id: result.model_category_id }) : Promise.resolve(null),
            result.model_source_id ? CloudProviderEntity.findOneBy({ id: result.model_source_id }) : Promise.resolve(null),
            result.model_2_source_id ? CloudProviderEntity.findOneBy({ id: result.model_2_source_id }) : Promise.resolve(null),
            result.model_class_id ? ModelClassEntity.findOneBy({ id: result.model_class_id }) : Promise.resolve(null),
            result.model_2_class_id ? ModelClassEntity.findOneBy({ id: result.model_2_class_id }) : Promise.resolve(null),
            result.base_model ? ModelEntity.findOneBy({ id: result.base_model }) : Promise.resolve(null),
            result.gpu_type ? HardwareMasterEntity.findOneBy({ id: result.gpu_type }) : Promise.resolve(null),
            result.hardware_1_gpu_type ? HardwareMasterEntity.findOneBy({ id: result.hardware_1_gpu_type }) : Promise.resolve(null),
            result.hardware_2_gpu_type ? HardwareMasterEntity.findOneBy({ id: result.hardware_2_gpu_type }) : Promise.resolve(null),
            (result.ai_model || result.inference_setting?.ai_model) ? ModelEntity.findOneBy({ id: result.ai_model || result.inference_setting.ai_model }) : Promise.resolve(null),
            result.base_model_2 ? ModelEntity.findOneBy({ id: result.base_model_2 }) : Promise.resolve(null),
            result.cloud_secret_id_1 ? CloudSecretsEntity.findOneBy({ id: result.cloud_secret_id_1 }) : Promise.resolve(null),
            result.cloud_secret_id_2 ? CloudSecretsEntity.findOneBy({ id: result.cloud_secret_id_2 }) : Promise.resolve(null),
            result.evaluation_task_id ? EvaluationTaskEntity.findOneBy({ id: result.evaluation_task_id }) : Promise.resolve(null),
            customDatasetIds.length ? DataSetEntity.findBy({ id: In(customDatasetIds), is_delete: 0 }) : Promise.resolve([]),
            libraryDatasetIds.length ? BenchmarkingDatasetEntity.findBy({ id: In(libraryDatasetIds), is_delete: 0 }) : Promise.resolve([]),
        ]);

        let model1Class = modelClass1?.name || null;
        if (result.base_model && !model1Class && (baseModel as any)?.model_class_id) {
            const mc = await ModelClassEntity.findOneBy({ id: (baseModel as any).model_class_id });
            model1Class = mc?.name || null;
        }

        let model2Class = modelClass2?.name || null;
        if (result.base_model_2 && !model2Class && (baseModel2 as any)?.model_class_id) {
            const mc = await ModelClassEntity.findOneBy({ id: (baseModel2 as any).model_class_id });
            model2Class = mc?.name || null;
        }

        let knowledgebase_details = null;
        if (result.knowledgebase_id) {
            try {
                const jobService = new KnowledgeBaseJobService();
                const existingJob = await jobService.entity
                    .createQueryBuilder('job')
                    .where('job.knowledge_base_id = :kbId', { kbId: result.knowledgebase_id })
                    .orderBy('job.id', 'DESC')
                    .getOne();

                const kbSourceMappingService = new KnowledgeBaseSourceMappingService();
                knowledgebase_details = await kbSourceMappingService.buildKafkaPayload(result.knowledgebase_id, existingJob?.id);
            } catch (error) {
                console.error("Error building KB payload for benchmarking:", error);
            }
        }

        return {
            benchmarking_id: result.id,
            benchmarking_name: result.name,
            benchmarking_type: result.benchmarking_type,
            org_id: result.company_id,
            member_id: result.member_id,
            ...(result.benchmarking_type === BenchmarkingType.MODEL && {
                model_benchmarking: {
                    model_category: modelCategory?.name || null,

                    // Model 1 Details
                    model_1_source: modelOneSource?.name || null,
                    model_1_path: result.model_path,
                    model_1_class: model1Class,
                    model_type: result.model_type,
                    base_1_model: baseModel?.name || null,
                    base_model_1_id: result.base_model,
                    base_model_1_category: result.base_model_1_category,
                    cloud_secret_id_1: result.cloud_secret_id_1,
                    cloud_secret_1_name: cloudSecret1?.name || null,
                    cloud_secret_1_data: cloudSecret1?.secrets || null,

                    // Model 2 Details
                    model_2_source: modelTwoSource?.name || null,
                    model_2_path: result.model_2_path,
                    model_2_class: model2Class,
                    model_2_type: result.model_2_type,
                    base_2_model: baseModel2?.name || null,
                    base_model_2_id: result.base_model_2,
                    base_model_2_category: result.base_model_2_category,
                    cloud_secret_id_2: result.cloud_secret_id_2,
                    cloud_secret_2_name: cloudSecret2?.name || null,
                    cloud_secret_2_data: cloudSecret2?.secrets || null,
                    datasets: [
                        ...customDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.name,
                            path: dataset.dataset_path,
                            yotta_bucket_path: dataset.yotta_bucket_path,
                            status: dataset.status,
                            type: "custom_dataset"
                        })),
                        ...libraryDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.dataset_name,
                            path: null,
                            yotta_bucket_path: null,
                            status: "active",
                            type: "dataset_library"
                        }))
                    ],
                    accelerator: accelerator?.model_name || null,
                    accelerator_count: result.gpu_count_per_node,
                }
            }),
            ...(result.benchmarking_type === BenchmarkingType.HARDWARE && {
                hardware_benchmarking: {
                    hardware_1: {
                        accelerator: hardwareOne?.model_name || null,
                        accelerator_count: result.hardware_1_gpu_count_per_node,
                    },
                    hardware_2: {
                        accelerator: hardwareTwo?.model_name || null,
                        accelerator_count: result.hardware_2_gpu_count_per_node,
                    },
                    ai_model: aiModel?.name || null,
                    ai_model_id: result.ai_model || result.inference_setting?.ai_model,
                    datasets: [
                        ...customDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.name,
                            path: dataset.dataset_path,
                            yotta_bucket_path: dataset.yotta_bucket_path,
                            status: dataset.status,
                            type: "custom_dataset"
                        })),
                        ...libraryDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.dataset_name,
                            path: null,
                            yotta_bucket_path: null,
                            status: "active",
                            type: "dataset_library"
                        }))
                    ],
                    prompt: result.prompt || result.inference_setting?.prompt,
                }
            }),
            ...(result.benchmarking_type === BenchmarkingType.MODEL_EVALUATION && {
                model_evaluation: {
                    // Single model evaluation - simplified compared to 2-model benchmarking
                    model: {
                        source: modelOneSource?.name || null,
                        path: result.model_path,
                        class: model1Class,
                        type: result.model_type,
                        base_model_id: result.base_model,
                        base_model_name: baseModel?.name || null,
                        cloud_secret_id: result.cloud_secret_id_1,
                        cloud_secret_name: cloudSecret1?.name || null,
                        cloud_secret_data: cloudSecret1?.secrets || null,
                    },
                    hardware: {
                        accelerator: hardwareOne?.model_name || null,
                        accelerator_count: result.hardware_1_gpu_count_per_node,
                        gpu_type_id: result.hardware_1_gpu_type,
                    },
                    evaluation_task_id: result.evaluation_task_id || null,
                    evaluation_task_name: evaluationTask?.name || null,
                    datasets: [
                        ...customDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.name,
                            path: dataset.dataset_path,
                            yotta_bucket_path: dataset.yotta_bucket_path,
                            status: dataset.status,
                            type: "custom_dataset"
                        })),
                        ...libraryDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.dataset_name,
                            path: null,
                            yotta_bucket_path: null,
                            status: "active",
                            type: "dataset_library"
                        }))
                    ],
                }
            }),
            ...(result.benchmarking_type === BenchmarkingType.RAG && {
                rag_benchmarking: {
                    model_category: modelCategory?.name || null,

                    // Model 1 Details
                    model_1_source: modelOneSource?.name || null,
                    model_1_path: result.model_path,
                    model_1_class: model1Class,
                    model_type: result.model_type,
                    base_1_model: baseModel?.name || null,
                    base_model_1_id: result.base_model,
                    base_model_1_category: result.base_model_1_category,
                    cloud_secret_id_1: result.cloud_secret_id_1,
                    cloud_secret_1_name: cloudSecret1?.name || null,
                    cloud_secret_1_data: cloudSecret1?.secrets || null,

                    // Model 2 Details
                    model_2_source: modelTwoSource?.name || null,
                    model_2_path: result.model_2_path,
                    model_2_class: model2Class,
                    model_2_type: result.model_2_type,
                    base_2_model: baseModel2?.name || null,
                    base_model_2_id: result.base_model_2,
                    base_model_2_category: result.base_model_2_category,
                    cloud_secret_id_2: result.cloud_secret_id_2,
                    cloud_secret_2_name: cloudSecret2?.name || null,
                    cloud_secret_2_data: cloudSecret2?.secrets || null,

                    datasets: [
                        ...customDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.name,
                            path: dataset.dataset_path,
                            yotta_bucket_path: dataset.yotta_bucket_path,
                            status: dataset.status,
                            type: "custom_dataset"
                        })),
                        ...libraryDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.dataset_name,
                            path: null,
                            yotta_bucket_path: null,
                            status: "active",
                            type: "dataset_library"
                        }))
                    ],
                    accelerator: accelerator?.model_name || null,
                    accelerator_count: result.gpu_count_per_node,
                }
            }),
            inferencing_settings: result.inference_setting,
            inferencing_settings_2: result.inference_setting2,
            ...(knowledgebase_details && { knowledgebase_details })
        };
    }

    override transformModel(model: BenchmarkingModel): BenchmarkingModel {
        model.member_id = model.decryptToken?.member_id || model.member_id;
        model.benchmarking_type = model.benchmarking_type?.trim() as BenchmarkingType;
        model.inference_setting = typeof model.inference_setting === "string" ? JSON.parse(model.inference_setting) : model.inference_setting;
        model.inference_setting2 = typeof model.inference_setting2 === "string" ? JSON.parse(model.inference_setting2) : model.inference_setting2;
        model.model_path = model.model_path?.trim() || null;
        model.model_2_path = model.model_2_path?.trim() || null;
        model.model_type = model.model_type?.trim() || "";
        model.model_2_type = model.model_2_type?.trim() || "";
        model.dataset_id = typeof model.dataset_id === "string" ? JSON.parse(model.dataset_id) : model.dataset_id;
        model.evaluation_task_id = typeof model.evaluation_task_id === "string" ? parseInt(model.evaluation_task_id) : model.evaluation_task_id;
        model.knowledgebase_id = typeof model.knowledgebase_id === "string" ? parseInt(model.knowledgebase_id) : model.knowledgebase_id;

        return model;
    }

    public async initiateBenchmarking(result: BenchmarkingEntity): Promise<void> {
        const kafkaPayload = await this.buildKafkaPayload(result as any);
        console.log("Kafka Payload Sending:", JSON.stringify(kafkaPayload, null, 2));
        const topic = result.benchmarking_type === BenchmarkingType.MODEL_EVALUATION
            ? KAFKAPRODUCERS.EVALUATION_INIT
            : KAFKAPRODUCERS.BENCHMARKINGINIT;

        await KafkaService.getInstance().sendMessage(topic, kafkaPayload);
    }

    override async createPostProcess(
        result: BenchmarkingModel,
        model: BenchmarkingModel,
        files: any
    ): Promise<BenchmarkingModel> {
        return new Promise(async (resolve, reject) => {
            try {
                const datasetIds = Array.isArray(result.dataset_id) ? result.dataset_id : [];
                const customDatasetIds = datasetIds.filter((d: any) => d.type === "custom_dataset").map((d: any) => d.id);

                let hasFailedDatasets = false;
                let hasPendingDatasets = false;
                if (customDatasetIds.length > 0) {
                    const customDatasets = await DataSetEntity.findBy({ id: In(customDatasetIds), is_delete: 0 });
                    hasFailedDatasets = customDatasets.some(ds => ds.status === DatasetStatus.FAILED);
                    hasPendingDatasets = customDatasets.some(ds => !ds.download_status);
                }

                if (hasFailedDatasets) {
                    await this.entity.update({ id: result.id }, { status: BenchmarkingStatus.FAILED });
                    result.status = BenchmarkingStatus.FAILED;
                    await AuditLogService.logFailureIncident({
                        company_id: result.company_id,
                        member_id: model.decryptToken?.member_id || result.member_id,
                        module: this.getModuleName(),
                        entity_type: 'BenchmarkingEntity',
                        entity_id: result.id,
                        entity_name: result.name,
                        description: `Benchmarking ${result.name} failed`,
                        reason: 'One or more datasets failed to download',
                        metadata: {
                            failure_source: 'dataset',
                            dataset_id: result.dataset_id,
                        },
                    });
                } else if (hasPendingDatasets) {
                    // Update benchmarking status to 'Queued'
                    await this.entity.update({ id: result.id }, { status: 'Queued' });
                    result.status = 'Queued';
                    console.log(`📋 Benchmarking ${result.id}: Datasets are still downloading. Setting status to Queued.`);
                } else {
                    await this.initiateBenchmarking(result as any);
                }
                const notificationModel = new NotificationModel();
                notificationModel.module_name = ModuleType.BENCHMARKING;
                notificationModel.notification_type = 'Created';
                notificationModel.is_readed = false;
                notificationModel.company_id = result.company_id;
                notificationModel.user_id = result.member_id;
                notificationModel.message = `${result.name} benchmarking created successfully.`;
                const notificationService = new NotificationService();
                await notificationService.createRecord(notificationModel, null);

                // Track secret usage
                if (result.cloud_secret_id_1) {
                    CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id_1, 'Benchmarking');
                }
                if (result.cloud_secret_id_2) {
                    CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id_2, 'Benchmarking');
                }

                await AuditLogService.log({
                    company_id: result.company_id,
                    member_id: model.decryptToken?.member_id || result.member_id,
                    module: this.getModuleName(),
                    action: 'CREATE',
                    entity_type: 'BenchmarkingEntity',
                    entity_id: result.id,
                    entity_name: result.name,
                    description: `Of ${this.getCreationTypeLabel(result.benchmarking_type)}`,
                    metadata: {
                        benchmarking_name: result.name,
                        benchmarking_type: result.benchmarking_type,
                    },
                    ip_address: '',
                });

                resolve(result);
            } catch (error) {
                console.error("Benchmarking createPostProcess error:", error);
                reject(error);
            }
        });
    }

    override async prepareQueryById(param: any): Promise<any> {
        if (!param.id || isNaN(Number(param.id))) {
            return Promise.reject('E10063');
        }
        return new Promise(async (resolve, reject) => {
            try {

                const record = await this.entity
                    .createQueryBuilder("benchmarking")
                    .leftJoinAndSelect(MembersEntity, "members", "members.id = benchmarking.member_id")
                    .leftJoinAndSelect(ModelCategoryEntity, "modelCategory", "modelCategory.id = benchmarking.model_category_id")
                    .leftJoinAndSelect(ModelClassEntity, "modelClass", "modelClass.id = benchmarking.model_class_id")
                    .leftJoinAndSelect(ModelClassEntity, "model2Class", "model2Class.id = benchmarking.model_2_class_id")
                    .leftJoinAndSelect(CloudProviderEntity, "source", "source.id = benchmarking.model_source_id")
                    .leftJoinAndSelect(CloudProviderEntity, "model2Source", "model2Source.id = benchmarking.model_2_source_id")
                    .leftJoinAndSelect(ModelEntity, "baseModel", "baseModel.id = benchmarking.base_model")
                    .leftJoinAndSelect(ModelEntity, "baseModel2", "baseModel2.id = benchmarking.base_model_2")
                    .leftJoinAndSelect(ModelProviderEntity, "baseModelProvider", "baseModelProvider.id = baseModel.model_provider_id")
                    .leftJoinAndSelect(ModelProviderEntity, "baseModel2Provider", "baseModel2Provider.id = baseModel2.model_provider_id")
                    .leftJoinAndSelect(HardwareMasterEntity, "gpu", "gpu.id = benchmarking.gpu_type")
                    .leftJoinAndSelect(HardwareMasterEntity, "hardware1Gpu", "hardware1Gpu.id = benchmarking.hardware_1_gpu_type")
                    .leftJoinAndSelect(HardwareMasterEntity, "hardware2Gpu", "hardware2Gpu.id = benchmarking.hardware_2_gpu_type")
                    .leftJoinAndSelect(CloudSecretsEntity, "cloudSecret1", "cloudSecret1.id = benchmarking.cloud_secret_id_1")
                    .leftJoinAndSelect(CloudSecretsEntity, "cloudSecret2", "cloudSecret2.id = benchmarking.cloud_secret_id_2")
                    .leftJoinAndSelect(ModelEntity, "aiModel", "aiModel.id = benchmarking.ai_model")
                    .leftJoinAndSelect(ModelProviderEntity, "aiModelProvider", "aiModelProvider.id = aiModel.model_provider_id")
                    .leftJoinAndSelect(EvaluationTaskEntity, "evaluationTask", "evaluationTask.id = benchmarking.evaluation_task_id")
                    .leftJoinAndSelect(KnowledgeBaseEntity, "knowledgebase", "knowledgebase.id = benchmarking.knowledgebase_id")
                    .select([
                        "benchmarking.id AS id",
                        "benchmarking.name AS name",
                        "benchmarking.description AS description",
                        "benchmarking.benchmarking_type AS benchmarking_type",
                        "benchmarking.model_category_id AS model_category_id",
                        "benchmarking.model_source_id AS model_source_id",
                        "benchmarking.model_path AS model_path",
                        "benchmarking.model_class_id AS model_class_id",
                        "benchmarking.model_2_path AS model_2_path",
                        "benchmarking.model_2_class_id AS model_2_class_id",
                        "benchmarking.model_type AS model_type",
                        "benchmarking.model_2_type AS model_2_type",
                        "benchmarking.base_model AS base_model",
                        "benchmarking.model_2_source_id AS model_2_source_id",
                        "benchmarking.dataset_id AS dataset_id",
                        "benchmarking.gpu_type AS gpu_type",
                        "benchmarking.gpu_count_per_node AS gpu_count_per_node",
                        "benchmarking.hardware_1_gpu_type AS hardware_1_gpu_type",
                        "benchmarking.hardware_1_gpu_count_per_node AS hardware_1_gpu_count_per_node",
                        "benchmarking.hardware_2_gpu_type AS hardware_2_gpu_type",
                        "benchmarking.hardware_2_gpu_count_per_node AS hardware_2_gpu_count_per_node",
                        "benchmarking.inference_setting AS inference_setting",
                        "benchmarking.inference_setting2 AS inference_setting2",
                        "benchmarking.company_id AS company_id",
                        "benchmarking.member_id AS member_id",
                        "benchmarking.created_at AS created_at",
                        "benchmarking.modified_at AS modified_at",
                        "members.full_name AS created_by",
                        "members.profile_picture AS profile_picture",
                        "modelCategory.name AS model_category_name",
                        "modelClass.name AS model_class_name",
                        "model2Class.name AS model_2_class_name",
                        "source.name AS source_name",
                        "source.cloud_provider_image AS source_image",
                        "model2Source.name AS model_2_source_name",
                        "model2Source.cloud_provider_image AS model_2_source_image",
                        "baseModel.name AS base_model_name",
                        "baseModelProvider.model_provider_icon AS base_model_provider_image",
                        "baseModelProvider.id AS base_model_provider_id",
                        "baseModel2.name AS base_model_2_name",
                        "baseModel2Provider.model_provider_icon AS base_model_2_provider_image",
                        "baseModel2Provider.id AS base_model_2_provider_id",
                        "gpu.model_name AS gpu_name",
                        "hardware1Gpu.model_name AS hardware_1_gpu_name",
                        "hardware2Gpu.model_name AS hardware_2_gpu_name",
                        "cloudSecret1.name AS cloud_secret_1_name",
                        "cloudSecret2.name AS cloud_secret_2_name",
                        "benchmarking.base_model_1_category AS base_model_1_category",
                        "benchmarking.base_model_2_category AS base_model_2_category",
                        "benchmarking.ai_model AS ai_model",
                        "benchmarking.prompt AS prompt",
                        "aiModel.name AS ai_model_name",
                        "benchmarking.status AS status",
                        "benchmarking.model_1_status AS model_1_status",
                        "benchmarking.model_2_status AS model_2_status",
                        "benchmarking.results_1 AS results_1",
                        "benchmarking.results_2 AS results_2",
                        "aiModelProvider.model_provider_icon AS ai_model_provider_image",
                        "aiModelProvider.id AS ai_model_provider_id",
                        "evaluationTask.name AS evaluation_task_name",
                        "knowledgebase.name AS knowledgebase_name",
                    ])
                    .where("benchmarking.id = :id", { id: param.id })
                    .andWhere("benchmarking.is_delete = 0")
                    .getRawOne();

                if (!record) {
                    return reject(`E10064`);
                }

                // Resolve instance_type based on benchmarking type
                let instance_type = null;
                let instance_type_2 = null;
                if (record.benchmarking_type === BenchmarkingType.MODEL || record.benchmarking_type === BenchmarkingType.RAG) {
                    instance_type = record.gpu_name || null;
                } else if (record.benchmarking_type === BenchmarkingType.HARDWARE) {
                    instance_type = record.hardware_1_gpu_name || null;
                    instance_type_2 = record.hardware_2_gpu_name || null;
                }

                const datasetIds = Array.isArray(record.dataset_id) ? record.dataset_id : [];
                const customDatasetIds = datasetIds.filter((d: any) => d.type === "custom_dataset").map((d: any) => d.id);
                const libraryDatasetIds = datasetIds.filter((d: any) => d.type === "dataset_library").map((d: any) => d.id);

                const [customDatasets, libraryDatasets] = await Promise.all([
                    customDatasetIds.length ? DataSetEntity.findBy({ id: In(customDatasetIds), is_delete: 0 }) : Promise.resolve([]),
                    libraryDatasetIds.length ? BenchmarkingDatasetEntity.findBy({ id: In(libraryDatasetIds), is_delete: 0 }) : Promise.resolve([]),
                ]);

                let profilePicture = record.profile_picture;
                if (profilePicture && !profilePicture.startsWith("http")) {
                    try {
                        profilePicture = await this.generateSignedUrl("members", record.member_id, record.profile_picture);
                    } catch (_error) {
                        profilePicture = null;
                    }
                }

                let sourceImage = record.source_image;
                if (sourceImage && !sourceImage.startsWith("http")) {
                    try {
                        sourceImage = await this.generateSignedUrl("cloudProviderMedia", record.model_source_id, record.source_image);
                    } catch (_error) {
                        sourceImage = null;
                    }
                }

                let model2SourceImage = record.model_2_source_image;
                if (model2SourceImage && !model2SourceImage.startsWith("http")) {
                    try {
                        model2SourceImage = await this.generateSignedUrl("cloudProviderMedia", record.model_2_source_id, record.model_2_source_image);
                    } catch (_error) {
                        model2SourceImage = null;
                    }
                }

                let baseModelProviderImage = record.base_model_provider_image;
                if (baseModelProviderImage && !baseModelProviderImage.startsWith("http")) {
                    try {
                        baseModelProviderImage = await this.generateSignedUrl("modelProviderMedia", record.base_model_provider_id, record.base_model_provider_image);
                    } catch (_error) {
                        baseModelProviderImage = null;
                    }
                }

                let baseModel2ProviderImage = record.base_model_2_provider_image;
                if (baseModel2ProviderImage && !baseModel2ProviderImage.startsWith("http")) {
                    try {
                        baseModel2ProviderImage = await this.generateSignedUrl("modelProviderMedia", record.base_model_2_provider_id, record.base_model_2_provider_image);
                    } catch (_error) {
                        baseModel2ProviderImage = null;
                    }
                }

                const isHardwareBenchmarking = record.benchmarking_type === BenchmarkingType.HARDWARE;
                let aiModelProviderImage = record.ai_model_provider_image;
                if (aiModelProviderImage && !aiModelProviderImage.startsWith("http")) {
                    try {
                        aiModelProviderImage = await this.generateSignedUrl("modelProviderMedia", record.ai_model_provider_id, record.ai_model_provider_image);
                    } catch (_error) {
                        aiModelProviderImage = null;
                    }
                }

                if (isHardwareBenchmarking) {
                    baseModelProviderImage = aiModelProviderImage;
                    baseModel2ProviderImage = aiModelProviderImage;
                }

                const formattedRecord = {
                    ...record,
                    concurrent_users: record.concurrent_users || [],
                    datasets: [
                        ...customDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.name,
                            dataset_path: dataset.dataset_path,
                            type: "custom_dataset"
                        })),
                        ...libraryDatasets.map((dataset) => ({
                            id: dataset.id,
                            name: dataset.dataset_name,
                            dataset_path: null,
                            type: "dataset_library"
                        }))
                    ],
                    dataset_id: datasetIds,
                    profile_picture: profilePicture,
                    source_image: sourceImage,
                    model_2_source_image: model2SourceImage,
                    base_model_provider_image: baseModelProviderImage,
                    base_model_2_provider_image: baseModel2ProviderImage,
                    instance_type: instance_type,
                    instance_type_2: instance_type_2,
                    evaluation_task: record.evaluation_task_name
                };

                return resolve(formattedRecord);
            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
     * Updates benchmarking results from Kafka payload.
     */
    async updateResult(payload: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const benchmarkId = Number(payload.benchmark_id);
                const modelId = Number(payload.benchmark_model_id);

                const record = await this.entity.findOneBy({ id: benchmarkId });
                if (!record) return reject('Benchmarking record not found');

                // Determine result data based on benchmark type or payload structure
                const resultData = record.benchmarking_type === BenchmarkingType.HARDWARE
                    ? payload.results
                    : (payload.results?.datasets || payload.results);

                const updateData: any = {};

                if (modelId === 1) {
                    updateData.results_1 = resultData;
                    updateData.model_1_status = ModelBenchmarkingStatus.COMPLETED;
                } else if (modelId === 2) {
                    updateData.results_2 = resultData;
                    updateData.model_2_status = ModelBenchmarkingStatus.COMPLETED;
                }

                // Consolidate status
                const m1Status = modelId === 1 ? ModelBenchmarkingStatus.COMPLETED : record.model_1_status;
                const m2Status = modelId === 2 ? ModelBenchmarkingStatus.COMPLETED : record.model_2_status;
                updateData.status = this.calculateConsolidatedStatus(m1Status, m2Status);

                // Calculate time_taken when completed
                let timeTaken = 0;
                if (updateData.status === ModelBenchmarkingStatus.COMPLETED) {
                    const startTime = new Date(record.created_at).getTime();
                    const endTime = new Date().getTime();
                    const diffSeconds = (endTime - startTime) / 1000;
                    timeTaken = parseFloat(diffSeconds.toFixed(2));
                    updateData.execution_time = timeTaken;
                }

                await this.entity.update({ id: benchmarkId }, updateData);

                // Trigger billing in Utility Service if completed
                if (updateData.status === ModelBenchmarkingStatus.COMPLETED) {
                    const kafkaPayload = {
                        module: ModuleType.BENCHMARKING,
                        member_id: record.member_id,
                        company_id: record.company_id,
                        entity_id: record.id,
                        request: {
                            benchmarking_id: record.id,
                            time_taken: timeTaken,
                            benchmarking_type: record.benchmarking_type,
                            gpu_type: record.gpu_type,
                            gpu_count: record.gpu_count_per_node,
                            hardware_1_gpu_type: record.hardware_1_gpu_type,
                            hardware_1_gpu_count: record.hardware_1_gpu_count_per_node,
                            hardware_2_gpu_type: record.hardware_2_gpu_type,
                            hardware_2_gpu_count: record.hardware_2_gpu_count_per_node,
                        }
                    };
                    await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, kafkaPayload);
                }

                // WebSocket push
                const updatedRecord = await this.entity.findOneBy({ id: benchmarkId });
                // Completion auditing is owned by updateBenchmarkingStatus. Kafka sends
                // separate result and status events for the same completion, so logging
                // here as well creates two audit entries for one benchmarking run.
                await WebSocketService.pushMessageToCompany(record.company_id.toString(), {
                    module: ModuleType.BENCHMARKING,
                    entity: updatedRecord,
                });

                resolve('Benchmarking results updated successfully');
            } catch (error) {
                console.error('Benchmarking updateResult error:', error);
                reject(error);
            }
        });
    }

    /**
     * Maps incoming Kafka status strings to standardised ModelBenchmarkingStatus enum.
     */
    private mapToModelStatus(status: string): ModelBenchmarkingStatus {
        const lowerStatus = status.toLowerCase();

        if (lowerStatus.includes('failed') || lowerStatus.includes('error') || lowerStatus.includes('timeout')) {
            return ModelBenchmarkingStatus.FAILED;
        }

        if (lowerStatus === 'completed' || lowerStatus === 'benchmark completed' || lowerStatus === 'success' || lowerStatus === 'benchmark complete' || lowerStatus === 'done') {
            return ModelBenchmarkingStatus.COMPLETED;
        }

        if (lowerStatus === 'verifying model' || lowerStatus === 'verify model' || lowerStatus === 'health_check') return ModelBenchmarkingStatus.VERIFYING_MODEL;
        if (lowerStatus === 'model deploy' || lowerStatus === 'model deployed') return ModelBenchmarkingStatus.MODEL_DEPLOY;
        if (lowerStatus === 'dataset verify' || lowerStatus === 'verify dataset' || lowerStatus === 'dataset_loading') return ModelBenchmarkingStatus.DATASET_VERIFY;
        if (lowerStatus === 'benchmarking' || lowerStatus === 'benchmark running' || lowerStatus === 'running eval' || lowerStatus === 'inference' || lowerStatus === 'metrics' || lowerStatus === 'computing metrics') return ModelBenchmarkingStatus.BENCHMARKING;

        return ModelBenchmarkingStatus.PENDING;
    }

    private async logCompletionAudit(record: any, updatedRecord: any, metadata: any = {}): Promise<void> {
        if (record.status === ModelBenchmarkingStatus.COMPLETED || updatedRecord?.status !== ModelBenchmarkingStatus.COMPLETED) {
            return;
        }

        await AuditLogService.log({
            company_id: record.company_id,
            member_id: record.member_id,
            module: this.getModuleName(),
            action: 'COMPLETED',
            entity_type: 'BenchmarkingEntity',
            entity_id: record.id,
            entity_name: record.name,
            description: `Benchmarking ${record.name} completed`,
            metadata: {
                previous_status: record.status,
                current_status: updatedRecord.status,
                ...metadata,
            },
            ip_address: '',
        });
    }


    /**
     * Updates benchmarking status from Kafka payload.
     */
    async updateBenchmarkingStatus(payload: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const benchmarkId = Number(payload.benchmark_id || payload.id);
                const modelId = Number(payload.benchmark_model_id);
                const incomingStatus = payload.status;
                const mappedStatus = this.mapToModelStatus(incomingStatus);

                const record = await this.entity.findOneBy({ id: benchmarkId });
                if (!record) return reject('Benchmarking record not found');

                const updateData: any = {};
                if (modelId === 1) {
                    updateData.model_1_status = mappedStatus;
                } else if (modelId === 2) {
                    updateData.model_2_status = mappedStatus;
                }

                // Consolidate status
                const m1Status = modelId === 1 ? mappedStatus : record.model_1_status;
                const m2Status = modelId === 2 ? mappedStatus : record.model_2_status;
                updateData.status = this.calculateConsolidatedStatus(m1Status, m2Status);

                await this.entity.update({ id: benchmarkId }, updateData);

                const updatedRecord = await this.entity.findOneBy({ id: benchmarkId });
                await this.logCompletionAudit(record, updatedRecord, {
                    benchmark_model_id: modelId,
                    completion_source: 'status',
                });

                // WebSocket push
                await WebSocketService.pushMessageToCompany(record.company_id.toString(), {
                    module: ModuleType.BENCHMARKING,
                    entity: updatedRecord,
                });
                if ((updatedRecord.status == ModelBenchmarkingStatus.COMPLETED || updatedRecord.status == ModelBenchmarkingStatus.FAILED) && record.status !== updatedRecord.status) {
                    const notificationModel = new NotificationModel();
                    notificationModel.module_name = ModuleType.BENCHMARKING;
                    notificationModel.notification_type = 'Updated';
                    notificationModel.is_readed = false;
                    notificationModel.company_id = record.company_id;
                    notificationModel.user_id = record.member_id;
                    // const finalStatus = updateData.status === ModelBenchmarkingStatus.FAILED ? 'failed' : 'completed successfully';
                    notificationModel.message = `${record.name} benchmarking ${updatedRecord.status}.`;
                    const notificationService = new NotificationService();
                    await notificationService.createRecord(notificationModel, null);
                }

                if (updatedRecord.status === ModelBenchmarkingStatus.FAILED && record.status !== updatedRecord.status) {
                    await AuditLogService.logFailureIncident({
                        company_id: record.company_id,
                        member_id: record.member_id,
                        module: this.getModuleName(),
                        entity_type: 'BenchmarkingEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Benchmarking ${record.name} failed`,
                        reason: payload,
                        metadata: {
                            benchmark_model_id: modelId,
                            kafka_payload: payload,
                        },
                    });
                }
                resolve('Benchmarking status updated successfully');
            } catch (error) {
                console.error('Benchmarking updateStatus error:', error);
                reject(error);
            }
        });
    }

    /**
     * Updates evaluation specific status from Kafka payload.
     */
    async updateEvaluationStatus(payload: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const benchmarkId = Number(payload.eval_id || payload.benchmark_id || payload.id);
                const mappedStatus = payload.status;
                const record = await this.entity.findOneBy({ id: benchmarkId });
                if (!record) return reject('E10064');
                const updateData: any = {
                    status: mappedStatus,
                };
                payload.result ? updateData.results_1 = payload.result || {} : null;

                // Calculate time_taken when completed
                let timeTaken = 0;
                if (updateData.status === ModelBenchmarkingStatus.COMPLETED) {
                    const startTime = new Date(record.created_at).getTime();
                    const endTime = new Date().getTime();
                    const diffSeconds = (endTime - startTime) / 1000;
                    timeTaken = parseFloat(diffSeconds.toFixed(2));
                    updateData.execution_time = timeTaken;
                }

                await this.entity.update({ id: benchmarkId }, updateData);

                // Trigger billing in Utility Service if completed
                if (updateData.status === ModelBenchmarkingStatus.COMPLETED && payload.result !== undefined) {
                    const kafkaPayload = {
                        module: ModuleType.BENCHMARKING,
                        member_id: record.member_id,
                        company_id: record.company_id,
                        entity_id: record.id,
                        request: {
                            benchmarking_id: record.id,
                            time_taken: timeTaken,
                            benchmarking_type: record.benchmarking_type,
                            gpu_type: record.gpu_type,
                            gpu_count: record.gpu_count_per_node,
                            hardware_1_gpu_type: record.hardware_1_gpu_type,
                            hardware_1_gpu_count: record.hardware_1_gpu_count_per_node,
                            hardware_2_gpu_type: record.hardware_2_gpu_type,
                            hardware_2_gpu_count: record.hardware_2_gpu_count_per_node,
                        }
                    };
                    await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, kafkaPayload);
                }
                const updatedRecord = await this.entity.findOneBy({ id: benchmarkId });
                await this.logCompletionAudit(record, updatedRecord, {
                    completion_source: 'evaluation',
                });
                await WebSocketService.pushMessageToCompany(record.company_id.toString(), {
                    module: ModuleType.BENCHMARKING,
                    entity: updatedRecord,
                });

                if (updatedRecord.status == ModelBenchmarkingStatus.COMPLETED || updatedRecord.status == ModelBenchmarkingStatus.FAILED) {
                    const notificationModel = new NotificationModel();
                    notificationModel.module_name = ModuleType.BENCHMARKING;
                    notificationModel.notification_type = 'Updated';
                    notificationModel.is_readed = false;
                    notificationModel.company_id = record.company_id;
                    notificationModel.user_id = record.member_id;
                    notificationModel.message = `${record.name} benchmarking ${updatedRecord.status}.`;
                    const notificationService = new NotificationService();
                    await notificationService.createRecord(notificationModel, null);
                }

                if (updatedRecord.status === ModelBenchmarkingStatus.FAILED && record.status !== updatedRecord.status) {
                    await AuditLogService.logFailureIncident({
                        company_id: record.company_id,
                        member_id: record.member_id,
                        module: this.getModuleName(),
                        entity_type: 'BenchmarkingEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Benchmarking ${record.name} failed`,
                        reason: payload,
                        metadata: {
                            kafka_payload: payload,
                        },
                    });
                }
                resolve(true);
            } catch (error) {
                console.error('Benchmarking updateEvaluationStatus error:', error);
                reject(error);
            }
        });
    }

    /**
     * Consolidates the overall status of the benchmark based on individual model statuses.
     */
    private calculateConsolidatedStatus(model1Status: string | null, model2Status: string | null): string {
        const isFailed = (model1Status === ModelBenchmarkingStatus.FAILED || model2Status === ModelBenchmarkingStatus.FAILED);
        if (isFailed) return ModelBenchmarkingStatus.FAILED;

        const statusWeights: Record<string, number> = {
            [ModelBenchmarkingStatus.PENDING]: 1,
            [ModelBenchmarkingStatus.VERIFYING_MODEL]: 2,
            [ModelBenchmarkingStatus.MODEL_DEPLOY]: 3,
            [ModelBenchmarkingStatus.DATASET_VERIFY]: 4,
            [ModelBenchmarkingStatus.BENCHMARKING]: 5,
            [ModelBenchmarkingStatus.COMPLETED]: 6
        };

        const weight1 = statusWeights[model1Status as string] || 1;
        const weight2 = statusWeights[model2Status as string] || 1;

        const minWeight = Math.min(weight1, weight2);

        const consolidated = Object.keys(statusWeights).find(key => statusWeights[key] === minWeight);

        return consolidated || ModelBenchmarkingStatus.PENDING;
    }

    override async prepareQuery(param: BenchmarkingFilter): Promise<any> {
        try {
            const queryBuilder = this.entity
                .createQueryBuilder("benchmarking")
                .leftJoinAndSelect(MembersEntity, "members", "members.id = benchmarking.member_id")
                .leftJoinAndSelect(ModelCategoryEntity, "modelCategory", "modelCategory.id = benchmarking.model_category_id")
                .leftJoinAndSelect(ModelClassEntity, "modelClass", "modelClass.id = benchmarking.model_class_id")
                .leftJoinAndSelect(ModelClassEntity, "model2Class", "model2Class.id = benchmarking.model_2_class_id")
                .leftJoinAndSelect(CloudProviderEntity, "source", "source.id = benchmarking.model_source_id")
                .leftJoinAndSelect(CloudProviderEntity, "model2Source", "model2Source.id = benchmarking.model_2_source_id")
                .leftJoinAndSelect(ModelEntity, "baseModel", "baseModel.id = benchmarking.base_model")
                .leftJoinAndSelect(ModelEntity, "baseModel2", "baseModel2.id = benchmarking.base_model_2")
                .leftJoinAndSelect(ModelProviderEntity, "baseModelProvider", "baseModelProvider.id = baseModel.model_provider_id")
                .leftJoinAndSelect(ModelProviderEntity, "baseModel2Provider", "baseModel2Provider.id = baseModel2.model_provider_id")
                .leftJoinAndSelect(HardwareMasterEntity, "gpu", "gpu.id = benchmarking.gpu_type")
                .leftJoinAndSelect(HardwareMasterEntity, "hardware1Gpu", "hardware1Gpu.id = benchmarking.hardware_1_gpu_type")
                .leftJoinAndSelect(HardwareMasterEntity, "hardware2Gpu", "hardware2Gpu.id = benchmarking.hardware_2_gpu_type")
                .leftJoinAndSelect(CloudSecretsEntity, "cloudSecret1", "cloudSecret1.id = benchmarking.cloud_secret_id_1")
                .leftJoinAndSelect(CloudSecretsEntity, "cloudSecret2", "cloudSecret2.id = benchmarking.cloud_secret_id_2")
                .leftJoinAndSelect(ModelEntity, "aiModel", "aiModel.id = benchmarking.ai_model")
                .leftJoinAndSelect(ModelProviderEntity, "aiModelProvider", "aiModelProvider.id = aiModel.model_provider_id")
                .leftJoinAndSelect(KnowledgeBaseEntity, "knowledgebase", "knowledgebase.id = benchmarking.knowledgebase_id")
                .select([
                    "benchmarking.id AS id",
                    "benchmarking.name AS name",
                    "benchmarking.description AS description",
                    "benchmarking.benchmarking_type AS benchmarking_type",
                    "benchmarking.model_category_id AS model_category_id",
                    "benchmarking.model_source_id AS model_source_id",
                    "benchmarking.model_path AS model_path",
                    "benchmarking.model_class_id AS model_class_id",
                    "benchmarking.model_2_path AS model_2_path",
                    "benchmarking.model_2_class_id AS model_2_class_id",
                    "benchmarking.model_type AS model_type",
                    "benchmarking.model_2_type AS model_2_type",
                    "benchmarking.base_model AS base_model",
                    "benchmarking.model_2_source_id AS model_2_source_id",
                    "benchmarking.dataset_id AS dataset_id",
                    "benchmarking.gpu_type AS gpu_type",
                    "benchmarking.gpu_count_per_node AS gpu_count_per_node",
                    "benchmarking.hardware_1_gpu_type AS hardware_1_gpu_type",
                    "benchmarking.hardware_1_gpu_count_per_node AS hardware_1_gpu_count_per_node",
                    "benchmarking.hardware_2_gpu_type AS hardware_2_gpu_type",
                    "benchmarking.hardware_2_gpu_count_per_node AS hardware_2_gpu_count_per_node",
                    "benchmarking.knowledgebase_id AS knowledgebase_id",
                    "benchmarking.inference_setting AS inference_setting",
                    "benchmarking.inference_setting2 AS inference_setting2",
                    "benchmarking.company_id AS company_id",
                    "benchmarking.member_id AS member_id",
                    "benchmarking.created_at AS created_at",
                    "benchmarking.modified_at AS modified_at",
                    "members.full_name AS created_by",
                    "members.profile_picture AS profile_picture",
                    "modelCategory.name AS model_category_name",
                    "modelClass.name AS model_class_name",
                    "model2Class.name AS model_2_class_name",
                    "source.name AS source_name",
                    "source.cloud_provider_image AS source_image",
                    "model2Source.name AS model_2_source_name",
                    "model2Source.cloud_provider_image AS model_2_source_image",
                    "baseModel.name AS base_model_name",
                    "baseModelProvider.model_provider_icon AS base_model_provider_image",
                    "baseModelProvider.id AS base_model_provider_id",
                    "baseModel2.name AS base_model_2_name",
                    "baseModel2Provider.model_provider_icon AS base_model_2_provider_image",
                    "baseModel2Provider.id AS base_model_2_provider_id",
                    "gpu.model_name AS gpu_name",
                    "hardware1Gpu.model_name AS hardware_1_gpu_name",
                    "hardware2Gpu.model_name AS hardware_2_gpu_name",
                    "cloudSecret1.name AS cloud_secret_1_name",
                    "cloudSecret2.name AS cloud_secret_2_name",
                    "benchmarking.base_model_1_category AS base_model_1_category",
                    "benchmarking.base_model_2_category AS base_model_2_category",
                    "benchmarking.ai_model AS ai_model",
                    "benchmarking.prompt AS prompt",
                    "aiModel.name AS ai_model_name",
                    "benchmarking.status AS status",
                    "benchmarking.model_1_status AS model_1_status",
                    "benchmarking.model_2_status AS model_2_status",
                    "benchmarking.results_1 AS results_1",
                    "benchmarking.results_2 AS results_2",
                    "aiModelProvider.model_provider_icon AS ai_model_provider_image",
                    "aiModelProvider.id AS ai_model_provider_id",
                    "knowledgebase.name AS knowledgebase_name",
                ])
                .where("benchmarking.is_delete = :isDelete", { isDelete: param.is_delete ?? 0 })
                .orderBy("benchmarking.id", "DESC");

            if (param.company_id) {
                queryBuilder.andWhere("benchmarking.company_id = :companyId", { companyId: param.company_id });
            }

            if (param.search_text) {
                queryBuilder.andWhere("benchmarking.name ILIKE :searchText", { searchText: `%${param.search_text}%` });
            }

            if (param.type) {
                queryBuilder.andWhere("benchmarking.benchmarking_type = :type", { type: param.type });
            }

            if (param.status) {
                if (param.status === 'In Progress') {
                    queryBuilder.andWhere("benchmarking.status NOT IN (:...excludedStatuses)", { excludedStatuses: [ModelBenchmarkingStatus.FAILED, ModelBenchmarkingStatus.COMPLETED] });
                } else {
                    queryBuilder.andWhere("benchmarking.status = :status", { status: param.status });
                }
            }

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                queryBuilder.offset(offset);
                queryBuilder.limit(param.pageSize);
            }

            const countQuery = this.entity
                .createQueryBuilder("benchmarking")
                .leftJoin(ModelCategoryEntity, "modelCategory", "modelCategory.id = benchmarking.model_category_id")
                .leftJoin(ModelClassEntity, "modelClass", "modelClass.id = benchmarking.model_class_id")
                .leftJoin(CloudProviderEntity, "source", "source.id = benchmarking.model_source_id")
                .leftJoin(CloudProviderEntity, "model2Source", "model2Source.id = benchmarking.model_2_source_id")
                .leftJoin(ModelEntity, "baseModel", "baseModel.id = benchmarking.base_model")
                .leftJoin(ModelEntity, "aiModel", "aiModel.id = benchmarking.ai_model")
                .leftJoin(MembersEntity, "members", "members.id = benchmarking.member_id")
                .where("benchmarking.is_delete = :isDelete", { isDelete: param.is_delete ?? 0 });

            if (param.company_id) {
                countQuery.andWhere("benchmarking.company_id = :companyId", { companyId: param.company_id });
            }

            if (param.search_text) {
                countQuery.andWhere("benchmarking.name ILIKE :searchText", { searchText: `%${param.search_text}%` });
            }

            if (param.type) {
                countQuery.andWhere("benchmarking.benchmarking_type = :type", { type: param.type });
            }

            if (param.status) {
                if (param.status === 'In Progress') {
                    countQuery.andWhere("benchmarking.status NOT IN (:...excludedStatuses)", { excludedStatuses: [ModelBenchmarkingStatus.FAILED, ModelBenchmarkingStatus.COMPLETED] });
                } else {
                    countQuery.andWhere("benchmarking.status = :status", { status: param.status });
                }
            }

            if (param.id) {
                countQuery.andWhere("benchmarking.id = :id", { id: param.id });
            }

            const [records, total] = await Promise.all([
                queryBuilder.getRawMany(),
                countQuery.getCount(),
            ]);

            const formattedRecords = await Promise.all(
                records.map(async (record) => {
                    const isHardwareBenchmarking = record.benchmarking_type === BenchmarkingType.HARDWARE;
                    const datasetIds = Array.isArray(record.dataset_id) ? record.dataset_id : [];
                    const customDatasetIds = datasetIds.filter((d: any) => d.type === "custom_dataset").map((d: any) => d.id);
                    const libraryDatasetIds = datasetIds.filter((d: any) => d.type === "dataset_library").map((d: any) => d.id);

                    const [customDatasets, libraryDatasets] = await Promise.all([
                        customDatasetIds.length ? DataSetEntity.findBy({ id: In(customDatasetIds), is_delete: 0 }) : Promise.resolve([]),
                        libraryDatasetIds.length ? BenchmarkingDatasetEntity.findBy({ id: In(libraryDatasetIds), is_delete: 0 }) : Promise.resolve([]),
                    ]);

                    let profilePicture = record.profile_picture;
                    if (profilePicture && !profilePicture.startsWith("http")) {
                        try {
                            profilePicture = await this.generateSignedUrl("members", record.member_id, record.profile_picture);
                        } catch (_error) {
                            profilePicture = null;
                        }
                    }

                    let sourceImage = record.source_image;
                    if (sourceImage && !sourceImage.startsWith("http")) {
                        try {
                            sourceImage = await this.generateSignedUrl("cloudProviderMedia", record.model_source_id, record.source_image);
                        } catch (_error) {
                            sourceImage = null;
                        }
                    }

                    let model2SourceImage = record.model_2_source_image;
                    if (model2SourceImage && !model2SourceImage.startsWith("http")) {
                        try {
                            model2SourceImage = await this.generateSignedUrl("cloudProviderMedia", record.model_2_source_id, record.model_2_source_image);
                        } catch (_error) {
                            model2SourceImage = null;
                        }
                    }

                    let baseModelProviderImage = record.base_model_provider_image;
                    if (baseModelProviderImage && !baseModelProviderImage.startsWith("http")) {
                        try {
                            baseModelProviderImage = await this.generateSignedUrl("modelProviderMedia", record.base_model_provider_id, record.base_model_provider_image);
                        } catch (_error) {
                            baseModelProviderImage = null;
                        }
                    }

                    let baseModel2ProviderImage = record.base_model_2_provider_image;
                    if (baseModel2ProviderImage && !baseModel2ProviderImage.startsWith("http")) {
                        try {
                            baseModel2ProviderImage = await this.generateSignedUrl("modelProviderMedia", record.base_model_2_provider_id, record.base_model_2_provider_image);
                        } catch (_error) {
                            baseModel2ProviderImage = null;
                        }
                    }

                    let aiModelProviderImage = record.ai_model_provider_image;
                    if (aiModelProviderImage && !aiModelProviderImage.startsWith("http")) {
                        try {
                            aiModelProviderImage = await this.generateSignedUrl("modelProviderMedia", record.ai_model_provider_id, record.ai_model_provider_image);
                        } catch (_error) {
                            aiModelProviderImage = null;
                        }
                    }

                    if (isHardwareBenchmarking) {
                        baseModelProviderImage = aiModelProviderImage;
                        baseModel2ProviderImage = aiModelProviderImage;
                    }

                    return {
                        id: record.id,
                        name: record.name,
                        description: record.description,
                        benchmarking_type: record.benchmarking_type,
                        type: isHardwareBenchmarking ? record.benchmarking_type : record.model_category_name || record.benchmarking_type,
                        target: isHardwareBenchmarking
                            ? `${record.hardware_1_gpu_name || "Hardware 1"} vs ${record.hardware_2_gpu_name || "Hardware 2"}`
                            : `${record.model_path || record.base_model_name || "Model 1"} vs ${record.model_2_path || record.base_model_2_name || "Model 2"}`,
                        target_details: isHardwareBenchmarking
                            ? {
                                hardware_1: {
                                    gpu_type: record.hardware_1_gpu_type,
                                    gpu_name: record.hardware_1_gpu_name,
                                    gpu_count_per_node: record.hardware_1_gpu_count_per_node,
                                },
                                hardware_2: {
                                    gpu_type: record.hardware_2_gpu_type,
                                    gpu_name: record.hardware_2_gpu_name,
                                    gpu_count_per_node: record.hardware_2_gpu_count_per_node,
                                },
                                inference_setting: record.inference_setting,
                            }
                            : {
                                model_category_id: record.model_category_id,
                                model_category_name: record.model_category_name,
                                model_1_source_id: record.model_source_id,
                                model_1_source_name: record.source_name,
                                model_1_source_image: sourceImage,
                                base_model_id: record.base_model,
                                base_model_name: record.base_model_name,
                                base_model_provider_image: baseModelProviderImage,
                                base_model_2_id: record.base_model_2,
                                base_model_2_name: record.base_model_2_name,
                                base_model_2_provider_image: baseModel2ProviderImage,
                                model_2_source_id: record.model_2_source_id,
                                model_2_source_name: record.model_2_source_name,
                                model_2_source_image: model2SourceImage,
                                model_path: record.model_path,
                                cloud_secret_id_1: record.cloud_secret_id_1,
                                cloud_secret_1_name: record.cloud_secret_1_name,
                                model_2_path: record.model_2_path,
                                cloud_secret_id_2: record.cloud_secret_id_2,
                                cloud_secret_2_name: record.cloud_secret_2_name,
                                model_class_id: record.model_class_id,
                                model_class_name: record.model_class_name,
                                accelerator_details: {
                                    gpu_type: record.gpu_type,
                                    gpu_name: record.gpu_name,
                                    gpu_count_per_node: record.gpu_count_per_node,
                                },
                            },
                        source: {
                            id: record.model_source_id,
                            name: record.source_name,
                            image: sourceImage,
                        },
                        model_class: {
                            id: record.model_class_id,
                            name: record.model_class_name,
                        },
                        datasets: [
                            ...customDatasets.map((dataset) => ({
                                id: dataset.id,
                                name: dataset.name,
                                type: "custom_dataset"
                            })),
                            ...libraryDatasets.map((dataset) => ({
                                id: dataset.id,
                                name: dataset.dataset_name,
                                type: "dataset_library"
                            }))
                        ],
                        dataset_id: datasetIds,
                        inference_setting: record.inference_setting,
                        inference_setting2: record.inference_setting2,
                        base_model_2: record.base_model_2,
                        created_at: record.created_at,
                        modified_at: record.modified_at,
                        last_updated: record.modified_at,
                        created_by: record.created_by,
                        profile_picture: profilePicture,
                        base_model_1_category: record.base_model_1_category,
                        base_model_2_category: record.base_model_2_category,
                        model_2_class_name: record.model_2_class_name,
                        ai_model: record.ai_model,
                        prompt: record.prompt,
                        ai_model_name: record.ai_model_name,
                        status: record.status,
                        model_1_status: record.model_1_status,
                        model_2_status: record.model_2_status,
                        base_model_provider_image: baseModelProviderImage,
                        base_model_2_provider_image: baseModel2ProviderImage,
                        results_1: record.results_1,
                        results_2: record.results_2,
                    };
                })
            );

            return Promise.resolve({
                data: formattedRecords,
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
                        entity_type: 'BenchmarkingEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Deleted benchmarking - ${record.benchmarking_type}`,
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

export default BenchmarkingService;
