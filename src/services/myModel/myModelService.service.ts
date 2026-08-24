import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { ModelEntity } from "../../entities/modelEntity";
import * as CryptoJS from "crypto-js";
import { BaseServices } from "../baseService.services";
import { MyModelDto } from "../../database/repository/MyModel/mymodel.dto";
import { MyModelModel } from "../../database/repository/MyModel/mymodel.model";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { QuantizationEntity } from "../../entities/quantizationEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { HardwareSpecsEntity } from "../../entities/hardwareSpecsEntity";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { CloudRegionEntity } from "../../entities/cloudRegionEntity";
import { CloudAccountEntity } from "../../entities/cloudAccountEntity";
import {
  KAFKAPRODUCERS,
  ModuleType,
  MyModelStatus,
  NotificationType,
  InfraQueueModuleType,
  InfraQueueStatus,
} from "../../config";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import CloudSecretsService from "../cloudSecrets/cloudSecretsService.service";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import InfraAvailabilityService from "../infraAvailability/infraAvailabilityService.services";
import InfraQueueService from "../infraQueue/infraQueueService.services";
import { InfraQueueModel } from "../../database/repository/infraQueue/infraQueue.model";
import { PricingService } from "../../utils/pricing/pricingService";
import AuditLogService from "../auditLog/auditLogService.services";

class MyModelService extends BaseServices {
  constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService(), protected notificationService: NotificationService = new NotificationService()) {
    super(entity, awsService);
  }

  getModel(): MyModelModel {
    return new MyModelModel();
  }

  getDTO(): any {
    return MyModelDto;
  }

  getModuleName(): string {
    return "My Model";
  }

  async prepareQuery(param: any): Promise<any> {
    const queryBuilder = await this.entity
      .createQueryBuilder("model")
      .leftJoinAndSelect(
        CloudProviderEntity,
        "cloudProvider",
        "cloudProvider.id = model.cloud_provider_id"
      )
      .leftJoinAndSelect(
        QuantizationEntity,
        "quantization",
        "quantization.id = model.quantization_id"
      )
      .leftJoinAndSelect(
        MembersEntity,
        "members",
        "members.id = model.member_id"
      )
      .leftJoinAndSelect(
        HardwareSpecsEntity,
        "hardwareSpecs",
        "hardwareSpecs.id = model.accelerator_id"
      )
      .leftJoinAndSelect(
        HardwareMasterEntity,
        "hm",
        "hm.id = hardwareSpecs.hardware_master_id"
      )
      .leftJoin(
        InfraAllocationEntity,
        "deploy",
        "deploy.module_id = model.id AND deploy.is_delete = 0"
      )
      .leftJoinAndSelect(
        CloudRegionEntity,
        "cloudRegion",
        "cloudRegion.id = model.region_id"
      )
      .leftJoinAndSelect(
        ModelClassEntity,
        "modelClass",
        "modelClass.id = model.model_class_id"
      )
      .select([
        "model.id AS id",
        "model.status AS status",
        "model.name AS name",
        "model.description AS description",
        "cloudRegion.name AS region_name",
        "modelClass.name AS model_class_name",
        "model.created_at AS created_at",
        "model.member_id AS member_id",
        "members.profile_picture AS profile_picture",
        "model.model_unique_key AS model_unique_key",
        "model.quantization_id AS quantization_id",
        "model.cloud_provider_id AS cloud_provider_id",
        "model.model_source_repo AS model_source_repo",
        "cloudProvider.name AS model_source_name",
        "model.accelerator_count AS accelerator_count",
        "cloudProvider.cloud_provider_image AS cloud_provider_image",
        "quantization.name AS quantization_name",
        "members.full_name AS full_name",
        "hm.model_name AS model_name",
        "hm.manufacturer AS manufacturer",
        "hm.component_type AS component_type",
        "COUNT(deploy.id) AS deployment_count",
      ])
      .where("model.company_id = :company_id", { company_id: param.company_id })
      .andWhere("model.is_delete = :is_delete", { is_delete: param.is_delete || 0 })
      .groupBy(`
        model.id,
        cloudProvider.cloud_provider_image,
        quantization.name,
        cloudProvider.name,
        members.full_name,
        members.profile_picture,
        hm.model_name,
        hm.manufacturer,
        hm.component_type,
        "cloudRegion"."name",
        "modelClass"."name"
      `)
      .orderBy("model.id", "DESC");

    if (param.pageNumber && param.pageSize) {
      const offset = (param.pageNumber - 1) * param.pageSize;
      queryBuilder.offset(offset);
      queryBuilder.limit(param.pageSize);
    }
    if (param.search_text) {
      queryBuilder.andWhere("LOWER(model.name) LIKE :search", {
        search: `%${param.search_text.toLowerCase()}%`,
      });
    }

    if (param.status) {
      const statuses = Array.isArray(param.status)
        ? param.status
        : [param.status];

      queryBuilder.andWhere(
        "LOWER(model.status) IN (:...status)",
        { status: statuses.map((s: string) => s.toLowerCase()) }
      );
    }

    const query = await queryBuilder.getRawMany();
    const countQuery = this.entity
      .createQueryBuilder("model")
      .where("model.company_id = :company_id", { company_id: param.company_id })
      .andWhere("model.is_delete = :is_delete", { is_delete: param.is_delete || 0 });

    if (param.search_text) {
      countQuery.andWhere("LOWER(model.name) LIKE :search", {
        search: `%${param.search_text.toLowerCase()}%`,
      });
    }

    if (param.status) {
      const statuses = Array.isArray(param.status)
        ? param.status
        : [param.status];

      countQuery.andWhere(
        "LOWER(model.status) IN (:...status)",
        { status: statuses.map((s: string) => s.toLowerCase()) }
      );
    }


    // const total = await countQuery.getCount();

    // const result = await Promise.all(
    //   query.map(async (result) => ({
    //     id: result.id,
    //     created_at: result.created_at,
    //     modified_at: result.modified_at,
    //     is_delete: result.is_delete,
    //     name: result.name,
    //     deployment_count: result.deployment_count,
    //     abb: result.abb,
    //     optimization_configuration: result.optimization_configuration,
    //     model_configuration: result.model_configuration,
    //     pipeline_configuration: result.pipeline_configuration,
    //     description: result.description,
    //     region_name: result.region_name,
    //     model_class_name: result.model_class_name,
    //     status: result.status,
    //     member_id: result.member_id,
    //     model_unique_key: result.model_unique_key,
    //     quantization_id: result.quantization_id,
    //     quantization_name: result.quantization_name,
    //     model_provider_id: result.model_provider_id,
    //     model_source_repo: result.model_source_repo,
    //     model_source_name: result.model_source_name,
    //     accelerator_count: result.accelerator_count,
    //     cloud_provider_image: result.cloud_provider_image
    //       ? await this.generateSignedUrl(
    //         "cloudProviderMedia",
    //         result.cloud_provider_id,
    //         result.cloud_provider_image
    //       )
    //       : "",
    //     profile_picture_signed_url: result.profile_picture
    //       ? await this.generateSignedUrl(
    //         "members",
    //         result.member_id,
    //         result.profile_picture
    //       )
    //       : "",
    //     full_name: result.full_name,
    //     hardware_model_name: result.hardware_model_name,
    //     manufacturer: result.manufacturer,
    //     component_type: result.component_type,
    //     quantizationIds: result.quantization_id
    //       ? {
    //         id: result.quantization_id,
    //         name: result.quantization_name,
    //         short_description: result.quantization_short_description,
    //         precision: result.quantization_precision,
    //         optimization_configuration:
    //           result.quantization_optimization_configuration,
    //         model_configuration: result.quantization_model_configuration,
    //         pipeline_configuration:
    //           result.quantization_pipeline_configuration,
    //       }
    //       : {},
    //   }))
    // );

    const total = await countQuery.getCount();

    const result = await Promise.all(
      query.map(async (result) => {
        let profile_picture_signed_url: string | null = null;
        const profilePic = result.profile_picture;

        if (profilePic && profilePic.trim() !== "") {
          if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
            profile_picture_signed_url = profilePic;
          } else {
            try {
              profile_picture_signed_url = await this.generateSignedUrl(
                "members",
                result.member_id,
                profilePic
              );
            } catch {
              profile_picture_signed_url = null;
            }
          }
        }

        return {
          id: result.id,
          created_at: result.created_at,
          modified_at: result.modified_at,
          is_delete: result.is_delete,
          name: result.name,
          deployment_count: result.deployment_count,
          abb: result.abb,
          optimization_configuration: result.optimization_configuration,
          model_configuration: result.model_configuration,
          pipeline_configuration: result.pipeline_configuration,
          description: result.description,
          region_name: result.region_name,
          model_class_name: result.model_class_name,
          status: result.status,
          member_id: result.member_id,
          model_unique_key: result.model_unique_key,
          quantization_id: result.quantization_id,
          quantization_name: result.quantization_name,
          model_provider_id: result.model_provider_id,
          model_source_repo: result.model_source_repo,
          model_source_name: result.model_source_name,
          accelerator_count: result.accelerator_count,
          cloud_provider_image: result.cloud_provider_image
            ? await this.generateSignedUrl(
              "cloudProviderMedia",
              result.cloud_provider_id,
              result.cloud_provider_image
            )
            : "",
          profile_picture_signed_url: profile_picture_signed_url,

          full_name: result.full_name,
          manufacturer: result.manufacturer,
          hardware_model_name: result.hardware_model_name,
          configuration: result.model_name,
          component_type: result.component_type,

          quantizationIds: result.quantization_id
            ? {
              id: result.quantization_id,
              name: result.quantization_name,
              short_description: result.quantization_short_description,
              precision: result.quantization_precision,
              optimization_configuration:
                result.quantization_optimization_configuration,
              model_configuration: result.quantization_model_configuration,
              pipeline_configuration:
                result.quantization_pipeline_configuration,
            }
            : {},
        };
      })
    );

    return {
      data: result,
      pagination: {
        total,
        pageSize: param.pageSize,
        pageNumber: param.pageNumber,
      },
    };
  }

  async prepareQueryById(param: Pagination): Promise<any> {
    try {
      console.log("Preparing query for model ID:", param);

      // Validate model ID
      if (!param.id) {
        throw new Error("Model ID is required");
      }

      // Fetch the model entity by ID
      const modelEntity = await this.entity.findOne({
        where: { id: param.id, is_delete: 0 },
      });

      // Check if model exists
      if (!modelEntity) {
        throw new Error("Model not found");
      }

      // Fetch related data in parallel
      const [
        modelclassData,
        modelHardwareData,
        modelCloudProviderData,
        modelregionData,
        modelCloudAccountData,
        cloudMemberData,
        hostProviderData,
      ] = await Promise.all([
        ModelClassEntity.findOneBy({
          id: modelEntity.model_class_id,
          is_delete: 0,
        }),
        HardwareSpecsEntity.createQueryBuilder("hs")
          .select([
            "COALESCE(q.name, 'NA') as quantization_name",
            "hs.id as id",
            "hs.hardware_master_id as hardware_master_id",
            "hs.created_at as created_at",
            "hs.modified_at as modified_at",
            "hs.is_delete as is_delete",
            "hm.component_type as component_type",
            "hm.model_name as model_name",
            "hm.model_name as machine_type",
            "hm.manufacturer as manufacturer",
            "hm.core_count as core_count",
            "hm.thread_count as thread_count",
            "hm.clock_speed_ghz as clock_speed_ghz",
            "hm.vram_size_gb as vram_size_gb",
            "hm.vram_type as vram_type",
            "hm.storage_capacity_gb as storage_capacity_gb",
            "hm.storage_type as storage_type",
            "hs.interface as interface",
            "hs.extra_specs as extra_specs",
            "hs.vlan_id as vlan_id",
            "hs.region_id as region_id",
            "hs.zone_id as zone_id",
            "hs.cloud_provider_id as cloud_provider_id",
          ])
          .leftJoin(HardwareMasterEntity, "hm", "hm.id = hs.hardware_master_id")
          .leftJoin(ModelEntity, "m", "m.accelerator_id = hm.id")
          .leftJoin(QuantizationEntity, "q", "q.id = m.quantization_id AND q.is_delete = 0")
          .andWhere("hs.is_delete = 0")
          .andWhere("hm.is_delete = 0")
          .andWhere("m.id = :modelId", { modelId: modelEntity.id })
          .getRawOne(),
        CloudProviderEntity.findOneBy({
          id: modelEntity.cloud_provider_id,
          is_delete: 0,
        }),
        CloudRegionEntity.findOneBy({
          id: modelEntity.region_id,
          is_delete: 0,
        }),
        CloudAccountEntity.findOneBy({
          id: modelEntity.cloud_account_id,
          is_delete: 0,
        }),
        MembersEntity.findOneBy({ id: modelEntity.member_id, is_delete: 0 }),
        modelEntity.host_provider
          ? CloudProviderEntity.findOneBy({
            id: modelEntity.host_provider,
            is_delete: 0,
          })
          : Promise.resolve(null),
      ]);

      const model = {
        ...modelEntity, // Spread all model entity properties
        modelClass: modelclassData ? modelclassData.name : "",
        hardware: modelHardwareData ? modelHardwareData : "",
        cloud_provider: modelCloudProviderData
          ? modelCloudProviderData.name
          : "",
        cloud_provider_image: modelCloudProviderData.cloud_provider_image
          ? await this.generateSignedUrl(
            "cloudProviderMedia",
            modelCloudProviderData.id,
            modelCloudProviderData.cloud_provider_image
          )
          : "",
        region: modelregionData ? modelregionData.name : "",
        cloudAccount: modelCloudAccountData ? modelCloudAccountData : "",
        createdBy: cloudMemberData ? cloudMemberData.full_name : "",
        host_provider: modelEntity.host_provider,
        host_provider_name: hostProviderData ? hostProviderData.cloud_code : "",
        registry: modelEntity.registry,
        docker_image_url: modelEntity.docker_image_url,
        cpu_request: modelEntity.cpu_request,
        cpu_limit: modelEntity.cpu_limit,
        memory_request: modelEntity.memory_request,
        memory_limit: modelEntity.memory_limit,
        overall_configuration: modelEntity.overall_configuration,
      };

      return model;
    } catch (error) {
      console.error("Error in prepareQueryById:", error);
      throw error;
    }
  }

  override transformModel(model: MyModelModel): MyModelModel {
    model.status = MyModelStatus.JOB_RECEIVED;
    model.member_id = model.decryptToken.member_id;
    model.model_unique_key = CryptoJS.SHA256(
      Date.now().toString() + Math.random().toString()
    ).toString();
    return model;
  }

  async createPostProcess(result: MyModelModel): Promise<MyModelModel> {
    return new Promise(async (resolve, reject) => {
      const [
        modelclassData,
        modelHardwareData,
        modelCloudProviderData,
        modelregionData,
        modelCloudAccountData,
        cloudMemberData,
        QuantizationData,
        cloudSecretsData,
        hostProviderData,
      ] = await Promise.all([
        ModelClassEntity.findOneBy({ id: result.model_class_id, is_delete: 0 }),
        result.accelerator_id
          ? HardwareMasterEntity.findOneBy({
            id: result.accelerator_id,
            is_delete: 0,
          })
          : Promise.resolve(null),
        CloudProviderEntity.findOneBy({
          id: result.cloud_provider_id,
          is_delete: 0,
        }),
        CloudRegionEntity.findOneBy({ id: result.region_id, is_delete: 0 }),
        CloudAccountEntity.findOneBy({
          id: result.cloud_account_id,
          is_delete: 0,
        }),
        MembersEntity.findOneBy({ id: result.member_id, is_delete: 0 }),
        QuantizationEntity.findOneBy({
          id: result.quantization_id,
          is_delete: 0,
        }),
        result.cloud_secret_id
          ? CloudSecretsEntity.findOneBy({
            id: result.cloud_secret_id,
            is_delete: 0,
          })
          : Promise.resolve(null),
        result.host_provider
          ? CloudProviderEntity.findOneBy({
            id: result.host_provider,
            is_delete: 0,
          })
          : Promise.resolve(null),
      ]);

      if (modelCloudProviderData && modelCloudProviderData.name === 'Docker') {
        await this.entity.update({ id: result.id }, {
          is_docker: true
        });
        result.is_docker = true;
      }

      const kafkaService = KafkaService.getInstance();

      // Build the request payload
      let request: any;
      let kafkaTopic: string;

      if (!result.is_compiled) {
        request = {
          id: result.id,
          org_id: result.company_id,
          is_docker: result.is_docker || false,
          source: {
            type: modelCloudProviderData.name.toUpperCase(),
            path: result.model_source_repo || "",
            credentials: cloudSecretsData ? cloudSecretsData.secrets : "",
          },
          modelClass: modelclassData ? modelclassData.name : "",
          infrastructure: {
            cloud_account: modelCloudAccountData
              ? modelCloudAccountData.account_name
              : "",
            region: modelregionData ? modelregionData.name : "",
            accelerator: modelHardwareData?.model_name || "H100",
            accelerator_count: result.accelerator_count?.toString() || "",
            machine: {
              type: result.machine_type_id?.toString() || "",
            },
          },
          quantization: QuantizationData ? QuantizationData.name : "FLOAT16",
          optimization_configuration: result.optimization_configuration || {},
          model_configuration: result.model_configuration || {},
          pipeline_configuration: result.pipeline_configuration || {},
          registry: result.registry,
          docker_image_url: result.docker_image_url,
          host_provider: hostProviderData ? hostProviderData.cloud_code : result.host_provider,
          cpu_request: result.cpu_request,
          cpu_limit: result.cpu_limit,
          memory_request: result.memory_request,
          memory_limit: result.memory_limit,
          overall_configuration: result.overall_configuration || {},
        };
        kafkaTopic = KAFKAPRODUCERS.MYMODEL;
      } else {
        const modelNameData = await ModelTrainingEntity.createQueryBuilder(
          "training"
        )
          .leftJoin(ModelEntity, "model", "model.id = training.model_id")
          .where("training.id = :trainingId", {
            trainingId: result.training_id,
          })
          .select(["training.id", "model.name AS model_name"])
          .getRawOne();

        const modelName = modelNameData?.model_name ?? null;
        request = {
          id: result.id,
          org_id: result.company_id,
          is_docker: result.is_docker || false,
          model_name: modelName,
          source: {
            type: modelCloudProviderData.name.toUpperCase(),
            path: result.model_source_repo || "",
            credentials: cloudSecretsData ? cloudSecretsData.secrets : "",
          },
          modelClass: modelclassData ? modelclassData.name : "",
          infrastructure: {
            cloud_account: modelCloudAccountData
              ? modelCloudAccountData.account_name
              : "",
            region: modelregionData ? modelregionData.name : "",
            accelerator: modelHardwareData?.model_name || "L40S",
            accelerator_count: result.accelerator_count?.toString() || "",
            machine: {
              type: result.machine_type_id?.toString() || "",
            },
          },
          quantization: QuantizationData ? QuantizationData.name : "FLOAT16",
          optimization_configuration: result.optimization_configuration || {},
          model_configuration: result.model_configuration || {},
          pipeline_configuration: result.pipeline_configuration || {},
          training_id: result.training_id,
          is_compiled: result.is_compiled,
          registry: result.registry,
          docker_image_url: result.docker_image_url,
          host_provider: hostProviderData ? hostProviderData.cloud_code : result.host_provider,
          cpu_request: result.cpu_request,
          cpu_limit: result.cpu_limit,
          memory_request: result.memory_request,
          memory_limit: result.memory_limit,
          overall_configuration: result.overall_configuration || {},
        };
        kafkaTopic = KAFKAPRODUCERS.COMPILEINIT;
      }

      // Check GPU availability before sending to Kafka
      if (result.accelerator_id && result.accelerator_count) {
        const availabilityService = new InfraAvailabilityService();
        const { available, freeCount } = await availabilityService.checkAvailabilityByUtilization(
          result.accelerator_id,
          result.accelerator_count
        );

        if (available) {
          // Resources available - push directly to Kafka
          console.log(`✅ MyModel ${result.id}: Resources available (${freeCount} free). Sending to Kafka.`);
          await kafkaService.sendMessage(kafkaTopic, request);
        } else {
          // Resources not available - add to queue
          console.log(`📋 MyModel ${result.id}: Resources unavailable (${freeCount} free, need ${result.accelerator_count}). Adding to queue.`);

          const queueService = new InfraQueueService();
          const queueItem = new InfraQueueModel();
          queueItem.module_type = InfraQueueModuleType.MODEL;
          queueItem.module_id = result.id;
          queueItem.accelerator_id = result.accelerator_id;
          queueItem.accelerator_count = result.accelerator_count;
          queueItem.status = InfraQueueStatus.PENDING;
          queueItem.payload = { ...request, kafkaTopic };
          queueItem.company_id = result.company_id;
          queueItem.member_id = result.member_id;
          queueItem.priority = 0;

          await queueService.addToQueue(queueItem);

          // Update model status to QUEUED
          await this.entity.update({ id: result.id }, { status: MyModelStatus.QUEUED });
          result.status = MyModelStatus.QUEUED;

          // Send WebSocket notification about queued status
          await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
            module: ModuleType.MYMODEL,
            entity: { ...result, status: MyModelStatus.QUEUED }
          });
        }
      } else {
        // No accelerator specified - use original behavior (direct Kafka push)
        await kafkaService.sendMessage(kafkaTopic, request);
      }

      // Send Notification for New Deployment
      // Track secret usage
      if (result.cloud_secret_id) {
          CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id, 'My Model');
      }

      const notificationModel = new NotificationModel();
      notificationModel.user_id = result.member_id;
      const userName = cloudMemberData ? cloudMemberData.full_name : 'User';
      notificationModel.message = `${userName} created a new AI Model - ${result.name}`;
      notificationModel.notification_type = NotificationType.CREATED;
      notificationModel.module_name = ModuleType.MYMODEL;
      notificationModel.is_readed = false;
      notificationModel.company_id = result.company_id;
      await this.notificationService.createRecord(notificationModel, null);

      await AuditLogService.log({
        company_id: result.company_id,
        member_id: result.member_id,
        module: this.getModuleName(),
        action: 'CREATE',
        entity_type: 'MyModelEntity',
        entity_id: result.id,
        entity_name: result.name,
        description: `My Model ${result.name} was created`,
        ip_address: '',
      });

      resolve(result);
    });
  }

  async updateStatus(model: MyModelModel): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const result = await this.entity.findOneBy({ id: model.id });
      if (result) {

        const STATUS_ORDER = [
          MyModelStatus.QUEUED,
          MyModelStatus.JOB_RECEIVED,
          MyModelStatus.ACCEPTED,
          MyModelStatus.LAUNCHED_OPTIMISATION_CLUSTER,
          MyModelStatus.STARTING_MODEL_DOWNLOAD,
          MyModelStatus.MODEL_DOWNLOADED,
          MyModelStatus.QUANTIZATION_STARTING,
          MyModelStatus.QUANTIZATION_COMPLETED,
          MyModelStatus.SAVING_AND_UPLOADING,
          MyModelStatus.SAVING_DONE,
          MyModelStatus.UPLOADING_DONE,
          MyModelStatus.CLEANED_UP,
          MyModelStatus.MODEL_READY,
          MyModelStatus.SUCCESS,
          MyModelStatus.FAILED
        ];

        const currentStatusIndex = STATUS_ORDER.indexOf(result.status as MyModelStatus);
        const incomingStatusIndex = STATUS_ORDER.indexOf(model.status as MyModelStatus);

        // If both statuses are part of the known progression, ignore out-of-order/older updates
        if (currentStatusIndex !== -1 && incomingStatusIndex !== -1 && incomingStatusIndex <= currentStatusIndex) {
          console.log(`[MyModelService] Ignoring older out-of-order status update for model ${model.id}: ${model.status} <= ${result.status}`);
          return resolve("Ignored older status update");
        }

        const currentLog = result.status_log || [];
        const logEntry = {
          status: model.status,
          timestamp: new Date().toISOString()
        };

        const updateData: any = {
          quantization_endpoint: model.quantization_endpoint,
          status: model.status,
          status_log: [...currentLog, logEntry]
        };

        if (model.status === MyModelStatus.MODEL_READY || (model.status as string) === 'COMPLETED') {
          const currentTime = new Date().getTime();
          const startTime = new Date(result.created_at).getTime();
          const executionTimeSeconds = Math.floor((currentTime - startTime) / 1000);
          updateData.execution_time = executionTimeSeconds;
          console.log(`[MyModelService] Model ${model.id} SUCCESS. Execution time: ${executionTimeSeconds}s`);
        } else if (model.status === MyModelStatus.FAILED || (model.status as string) === 'FAILED') {
          updateData.execution_time = 0;
        }

        await this.entity.update({ id: model.id }, updateData);
        const updatedEntity = await this.entity.findOneBy({ id: model.id });

        const completionStatuses = [MyModelStatus.MODEL_READY, MyModelStatus.SUCCESS, 'COMPLETED'];
        const isCompletionStatus = completionStatuses.includes(model.status as string);
        const wasAlreadyCompleted = completionStatuses.includes(result.status as string);

        if (isCompletionStatus && !wasAlreadyCompleted) {
          await AuditLogService.log({
            company_id: updatedEntity.company_id,
            member_id: updatedEntity.member_id,
            module: this.getModuleName(),
            action: 'COMPLETED',
            entity_type: 'ModelEntity',
            entity_id: updatedEntity.id,
            entity_name: updatedEntity.name,
            description: `AI Model ${updatedEntity.name} completed`,
            metadata: {
              previous_status: result.status,
              current_status: model.status,
            },
            ip_address: '',
          });
        }

        if ((model.status === MyModelStatus.FAILED || (model.status as string) === 'FAILED') && result.status !== MyModelStatus.FAILED) {
          await AuditLogService.logFailureIncident({
            company_id: updatedEntity.company_id,
            member_id: updatedEntity.member_id,
            module: this.getModuleName(),
            entity_type: 'ModelEntity',
            entity_id: updatedEntity.id,
            entity_name: updatedEntity.name,
            description: `AI Model ${updatedEntity.name} failed`,
            reason: model.latest_kafka_message,
            metadata: {
              kafka_payload: model.latest_kafka_message,
              previous_status: result.status,
              current_status: model.status,
            },
          });
        }

        // Cost Calculation and Reporting
        if ((model.status === MyModelStatus.MODEL_READY || (model.status as string) === 'COMPLETED') && updatedEntity.execution_time > 0) {
          try {
            const psec = await PricingService.getPricePerSec(result.company_id, result.accelerator_id);
            const totalCost = updatedEntity.execution_time * psec;

            const costPayload = {
              company_id: result.company_id,
              member_id: result.member_id,
              module: "Mymodel",
              execution_time: updatedEntity.execution_time,
              price_per_sec: psec,
              total_cost: totalCost,
              resource_id: result.id,
              accelerator_id: result.accelerator_id
            };

            console.log(`[MyModelService] Reporting cost for model ${model.id}:`, costPayload);
            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, costPayload);
          } catch (costError) {
            console.error(`[MyModelService] Error calculating/reporting cost for model ${model.id}:`, costError);
          }
        }

        WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.MYMODEL,
          entity: updatedEntity,
        });
        console.log("Model status updated:", updatedEntity);

        // Send Notification for Status Change only on SUCCESS or FAILED
        if (model.status === MyModelStatus.MODEL_READY || model.status === MyModelStatus.FAILED) {
          const notificationModel = new NotificationModel();
          notificationModel.user_id = updatedEntity.member_id;
          const member = await MembersEntity.findOneBy({ id: updatedEntity.member_id });
          const userName = member ? member.full_name : 'User';
          const statusText = model.status === MyModelStatus.MODEL_READY ? 'compiled successfully' : 'failed to compile';
          notificationModel.message = `AI Model ${updatedEntity.name} ${statusText}`;
          notificationModel.notification_type = NotificationType.UPDATED;
          notificationModel.module_name = ModuleType.MYMODEL;
          notificationModel.is_readed = false;
          notificationModel.company_id = updatedEntity.company_id;
          await this.notificationService.createRecord(notificationModel, null);
        }

        resolve("Model Status Updated Successfully");
      } else {
        reject("E10043");
      }
    });
  }

  public override updateDeleteFlagData = async (param: any): Promise<boolean> => {
    try {
      const whereid = await this.updateDeleteFlagPreProcess(param);
      if (whereid === null) {
        return false;
      } else {
        const record = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
        if (record && record.length > 0) {
          await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();
          
          for (const model of record) {
            await AuditLogService.log({
              company_id: model.company_id,
              member_id: param.decryptToken?.member_id || model.member_id,
              module: this.getModuleName(),
              action: 'DELETE',
              entity_type: 'ModelEntity',
              entity_id: model.id,
              entity_name: model.name,
              description: `Model ${model.name} was deleted`,
              ip_address: param.ip_address || '',
            });
          }
          return true;
        } else {
          return false;
        }
      }
    } catch (e) {
      throw e;
    }
  };
}

export default MyModelService;
