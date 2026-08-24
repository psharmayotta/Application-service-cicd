import * as CryptoJS from "crypto-js";
import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { BaseServices } from "../baseService.services";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { ModelTrainingModel } from "../../database/repository/modelTraining/modelTraining.model";
import { ModelTrainingDto } from "../../database/repository/modelTraining/modelTraining.dto";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { DataSetEntity } from "../../entities/dataSetEntity";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { DataSetModel } from "../../database/repository/dataSet/dataset.model";
import DataSetService from "../dataSet/dataSetService.services";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import {
  DATASETDOWNLOAD,
  ModelTrainingStatus,
  MODELTRAININGURL,
  ModuleType,
  KAFKAPRODUCERS,
  InfraQueueModuleType,
  InfraQueueStatus,
  NotificationType,
  DatasetStatus,
  WebhookEvents,
} from "../../config";
import { WebhookService } from "../webhook/webhookService.services";
import axios from "axios";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { KafkaService } from "../../utils/kafka/KafkaService";
import InfraAvailabilityService from "../infraAvailability/infraAvailabilityService.services";
import InfraQueueService from "../infraQueue/infraQueueService.services";
import { InfraQueueModel } from "../../database/repository/infraQueue/infraQueue.model";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { CloudRegionEntity } from "../../entities/cloudRegionEntity";
import { SourceEntity } from "../../entities/sourceEntity";
import { CloudAccountEntity } from "../../entities/cloudAccountEntity";
import { PricingService } from "../../utils/pricing/pricingService";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import AuditLogService from "../auditLog/auditLogService.services";

class ModelTrainingService extends BaseServices {
  constructor(
    entity: any = ModelTrainingEntity,
    protected awsService: AwsService = new AwsService(),
    protected notificationService: NotificationService = new NotificationService()
  ) {
    super(entity, awsService);
  }

  getModel(): ModelTrainingModel {
    return new ModelTrainingModel();
  }

  getDTO(): any {
    return ModelTrainingDto;
  }

  getModuleName(): string {
    return 'Training';
  }

  override createPreProcess(
    model: ModelTrainingModel
  ): Promise<ModelTrainingModel> {
    return new Promise<ModelTrainingModel>(async (resolve, reject) => {
      try {
        const existingTraining = await this.entity.findOne({
          where: {
            name: model.name,
            company_id: model.company_id,
            is_delete: 0,
          },
        });

        if (existingTraining) {
          return reject("E10045");
        }

        resolve(this.transformModel(model));
      } catch (error) {
        reject("E10040");
      }
    });
  }

  override createPostProcess(
    result: ModelTrainingModel,
    model: ModelTrainingModel,
    files: any
  ): Promise<ModelTrainingModel> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!result.dataset_id) {
          resolve(result);
          return;
        }

        const dataSetModel = await DataSetEntity.findOneBy({ id: result.dataset_id });
        if (!dataSetModel) {
          resolve(result);
          return;
        }

        // If the dataset has already failed, mark this training as FAILED immediately
        if (dataSetModel.status === DatasetStatus.FAILED) {
          await this.entity.update({ id: result.id }, { status: ModelTrainingStatus.FAILED, status_log: [{ status: ModelTrainingStatus.FAILED, timestamp: new Date().toISOString() }] });
          result.status = ModelTrainingStatus.FAILED;
          result.status_log = [{ status: ModelTrainingStatus.FAILED, timestamp: new Date().toISOString() }];

          await AuditLogService.logFailureIncident({
            company_id: result.company_id,
            member_id: result.member_id,
            module: this.getModuleName(),
            entity_type: 'ModelTrainingEntity',
            entity_id: result.id,
            entity_name: result.name,
            description: `Model Training ${result.name} failed`,
            reason: dataSetModel.failure_message || 'Dataset download failed',
            metadata: {
              dataset_id: result.dataset_id,
              failure_source: 'dataset',
            },
          });

          try {
            const notificationModel = new NotificationModel();
            notificationModel.user_id = result.member_id;
            notificationModel.message = `Training ${result.name} failed because dataset download failed.`;
            notificationModel.notification_type = NotificationType.UPDATED;
            notificationModel.module_name = ModuleType.TRAINING;
            notificationModel.is_readed = false;
            notificationModel.company_id = result.company_id;
            await this.notificationService.createRecord(notificationModel, null);
          } catch (notifErr) {
            console.error("Failed to create training immediate failed notification: ", notifErr);
          }

          resolve(result);
          return;
        }

        if (dataSetModel.download_status) {
          await this.initiateTraining(result as any);
        }

        await AuditLogService.log({
          company_id: result.company_id,
          member_id: result.member_id,
          module: this.getModuleName(),
          action: 'CREATE',
          entity_type: 'ModelTrainingEntity',
          entity_id: result.id,
          entity_name: result.name,
          description: `Model Training ${result.name} was created`,
          ip_address: '',
        });

        resolve(result);
      } catch (error) {
        console.log("ModelTrainingService createPostProcess error: ", error);
        reject(error);
      }
    });
  }

  public async initiateTraining(result: ModelTrainingEntity): Promise<void> {
    const dataSetModel = await DataSetEntity.findOneBy({ id: result.dataset_id });
    if (!dataSetModel || !dataSetModel.download_status) {
      return;
    }

    const modelData = await ModelEntity.findOneBy({
      id: result.model_id,
    });

    let acceleratorName = "";
    if (result.accelerator_id) {
      const hardwareMaster = await HardwareMasterEntity.findOneBy({ id: result.accelerator_id });
      if (hardwareMaster) {
        acceleratorName = hardwareMaster.model_name;
      }
    }

    if (result.evaluation_details) {
      if (result.evaluation_details.dataset_id) {
        const evalDataSet = await DataSetEntity.findOneBy({ id: result.evaluation_details.dataset_id });
        if (evalDataSet && evalDataSet.dataset_path) {
          result.evaluation_details['EVAL_DATASET_PATH'] = evalDataSet.dataset_path;
        }
      }
    }

    const payload = {
      request_id: result.request_id,
      company_id: result.company_id,
      training_id: result.id,
      model_name: modelData ? modelData.name : "",
      yotta_bucket_path: dataSetModel.yotta_bucket_path,
      accelerator: acceleratorName,
      accelerator_count: result.accelerator_count,
      training_configuration: {
        ...(result?.train_configuration || {}),
        ...(result?.dataset_configuration || {}),
        ...(result?.evaluation_details || {}),
      },
    };

    // Check if accelerator_id is provided for availability checking
    if (result.accelerator_id && result.accelerator_count) {
      const availabilityService = new InfraAvailabilityService();
      const { available, freeCount } = await availabilityService.checkAvailability(
        result.accelerator_id,
        result.accelerator_count,
        result.cloud_provider_id
      );

      if (available) {
        // Resources available - push directly to Kafka
        console.log(`✅ Training ${result.id}: Resources available (${freeCount} free). Sending to Kafka.`);
        await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.TRAININGINIT, payload);
      } else {
        // Resources not available - add to queue
        console.log(`📋 Training ${result.id}: Resources unavailable (${freeCount} free, need ${result.accelerator_count}). Adding to queue.`);

        const queueService = new InfraQueueService();
        const queueItem = new InfraQueueModel();
        queueItem.module_type = InfraQueueModuleType.TRAINING;
        queueItem.module_id = result.id;
        queueItem.accelerator_id = result.accelerator_id;
        queueItem.accelerator_count = result.accelerator_count;
        queueItem.status = InfraQueueStatus.PENDING;
        queueItem.payload = payload;
        queueItem.company_id = result.company_id;
        queueItem.member_id = result.member_id;
        queueItem.priority = 0;

        await queueService.addToQueue(queueItem);

        // Update training status to QUEUED
        await this.entity.update({ id: result.id }, { status: ModelTrainingStatus.QUEUED });
        result.status = ModelTrainingStatus.QUEUED;

        await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.TRAINING,
          entity: { ...result, status: ModelTrainingStatus.QUEUED }
        });
      }
    } else {
      // No accelerator specified - use original behavior (direct Kafka push)
      await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.TRAININGINIT, payload);
    }

    // Send Notification for New Training
    const notificationModel = new NotificationModel();
    notificationModel.user_id = result.member_id;
    const member = await MembersEntity.findOneBy({ id: result.member_id });
    const userName = member ? member.full_name : 'User';
    const modelNameForMsg = modelData ? modelData.name : result.name;
    notificationModel.message = `${userName} created a new training for ${modelNameForMsg}`;
    notificationModel.notification_type = NotificationType.CREATED;
    notificationModel.module_name = ModuleType.TRAINING;
    notificationModel.is_readed = false;
    notificationModel.company_id = result.company_id;
    await this.notificationService.createRecord(notificationModel, null);
  }

  async prepareQuery(param: Pagination): Promise<any> {
    const queryBuilder = await this.entity
      .createQueryBuilder("model_training")
      .leftJoinAndSelect(
        ModelCategoryEntity,
        "modelCategory",
        "modelCategory.id = model_training.model_category_id"
      )
      .leftJoinAndSelect(
        ModelTaskEntity,
        "modelTaskEntity",
        "modelTaskEntity.id = model_training.model_task_type_id"
      )
      .leftJoinAndSelect(
        MembersEntity,
        "members",
        "members.id = model_training.member_id"
      )
      .leftJoinAndSelect(
        CloudProviderEntity,
        "cloudProviderEntity",
        "cloudProviderEntity.id = model_training.cloud_provider_id"
      )
      .leftJoinAndSelect(
        DataSetEntity,
        "dataSetEntity",
        "dataSetEntity.id = model_training.dataset_id"
      )
      .leftJoinAndSelect(
        ModelEntity,
        "modelEntity",
        "modelEntity.id = model_training.model_id"
      )
      .leftJoinAndSelect(
        HardwareMasterEntity,
        "hardwareMasterEntity",
        "hardwareMasterEntity.id = model_training.accelerator_id"
      )
      .select([
        "model_training.model_id AS base_model_id",
        "model_training.dataset_id AS dataset_id",
        "model_training.id AS id",
        "model_training.status AS status",
        "model_training.name AS name",
        "model_training.description AS description",
        "model_training.created_at AS created_at",
        "model_training.member_id AS member_id",
        "model_training.execution_time AS execution_time",
        "modelCategory.name AS model_category_name",
        "modelTaskEntity.name AS model_task_name",
        "dataSetEntity.name AS data_set_name",
        "dataSetEntity.description AS data_set_description",
        "modelEntity.name AS base_model_name",
        "members.full_name AS created_by",
        "members.profile_picture AS profile_picture",
        "cloudProviderEntity.name AS cloud_provider_name",
        "hardwareMasterEntity.model_name AS accelerator_name",
        "model_training.training_type AS training_type",
      ])
      .where("model_training.company_id = :company_id", {
        company_id: param.company_id,
      })
      .orderBy("model_training.id", "DESC");

    // Handle is_delete filter
    if (param.is_delete !== undefined) {
      queryBuilder.andWhere("model_training.is_delete = :is_delete", { is_delete: param.is_delete });
    } else {
      queryBuilder.andWhere("model_training.is_delete = :is_delete", { is_delete: 0 });
    }

    // Filter by training_type
    if ((param as any).training_type) {
      queryBuilder.andWhere("model_training.training_type = :training_type", { training_type: (param as any).training_type });
    }

    // Filter by status
    if ((param as any).status) {
      const statuses = Array.isArray((param as any).status)
        ? (param as any).status
        : [(param as any).status];
      queryBuilder.andWhere("UPPER(model_training.status) IN (:...statuses)", { statuses: statuses.map((s: string) => s.toUpperCase()) });
    }

    // Search by model name or dataset name
    if (param.search_text) {
      const searchText = `%${param.search_text.toLowerCase()}%`;
      queryBuilder.andWhere(
        "(LOWER(model_training.name) LIKE :search OR LOWER(dataSetEntity.name) LIKE :search OR LOWER(model_training.status) LIKE :search)",
        { search: searchText }
      );
    }

    // Pagination
    if (param.pageNumber && param.pageSize) {
      const offset = (param.pageNumber - 1) * param.pageSize;
      queryBuilder.offset(offset);
      queryBuilder.limit(param.pageSize);
    }

    const query = await queryBuilder.getRawMany();

    // Count query
    const countQuery = this.entity
      .createQueryBuilder("model_training")
      .leftJoin(
        DataSetEntity,
        "dataSetEntity",
        "dataSetEntity.id = model_training.dataset_id"
      )
      .where("model_training.company_id = :company_id", {
        company_id: param.company_id,
      });

    if (param.is_delete !== undefined) {
      countQuery.andWhere("model_training.is_delete = :is_delete", { is_delete: param.is_delete });
    } else {
      countQuery.andWhere("model_training.is_delete = :is_delete", { is_delete: 0 });
    }

    if ((param as any).training_type) {
      countQuery.andWhere("model_training.training_type = :training_type", { training_type: (param as any).training_type });
    }

    if ((param as any).status) {
      const statuses = Array.isArray((param as any).status)
        ? (param as any).status
        : [(param as any).status];
      countQuery.andWhere("UPPER(model_training.status) IN (:...statuses)", { statuses: statuses.map((s: string) => s.toUpperCase()) });
    }

    if (param.search_text) {
      const searchText = `%${param.search_text.toLowerCase()}%`;
      countQuery.andWhere(
        "(LOWER(model_training.name) LIKE :search OR LOWER(dataSetEntity.name) LIKE :search  OR LOWER(model_training.status) LIKE :search)",
        { search: searchText }
      );
    }

    const total = await countQuery.getCount();

    const result = await Promise.all(
      query.map(async (result) => {
        let profilePictureUrl = result.profile_picture;
        if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
          try {
            profilePictureUrl = await this.generateSignedUrl('members', result.member_id, result.profile_picture);
          } catch (e) {
            console.error("Error generating signed URL for profile picture", e);
            profilePictureUrl = null;
          }
        }

        return {
          id: result.id,
          name: result.name,
          description: result.description,
          status: result.status,
          model_category_name: result.model_category_name,
          model_task_name: result.model_task_name,
          cloud_provider_name: result.cloud_provider_name,
          cloud_provider_description: result.cloud_provider_description,
          accelerator_name: result.accelerator_name,
          data_set_name: result.data_set_name,
          data_set_description: result.data_set_description,
          base_model_name: result.base_model_name,
          base_model_id: result.base_model_id,
          dataset_id: result.dataset_id,
          created_by: result.created_by,
          profile_picture: profilePictureUrl,
          created_at: result.created_at,
          training_type: result.training_type,
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
      if (!param.id) {
        return Promise.reject('E10006');
      }

      const query = await this.entity
        .createQueryBuilder("model")
        .leftJoinAndSelect(
          ModelCategoryEntity,
          "modelCategory",
          "modelCategory.id = model.model_category_id"
        )
        .leftJoinAndSelect(
          ModelTaskEntity,
          "modelTaskEntity",
          "modelTaskEntity.id = model.model_task_type_id"
        )
        .leftJoinAndSelect(
          ModelEntity,
          "modelentity",
          "modelentity.id = model.model_id"
        )
        .leftJoinAndSelect(
          SourceEntity,
          "sourceEntity",
          "modelentity.model_source_id = sourceEntity.id"
        )
        .leftJoinAndSelect(
          MembersEntity,
          "members",
          "members.id = model.member_id"
        )
        .leftJoinAndSelect(
          DataSetEntity,
          "datasetentity",
          "datasetentity.id = model.dataset_id"
        )
        .leftJoinAndSelect(
          ModelClassEntity,
          "modelClassEntity",
          "modelentity.model_class_id = modelClassEntity.id"
        )
        .leftJoinAndSelect(
          CloudAccountEntity,
          "cloudAccountEntity",
          "cloudAccountEntity.id = model.cloud_provider_id"
        )
        .leftJoinAndSelect(
          CloudProviderEntity,
          "datasetProvider",
          "datasetProvider.id = datasetentity.cloud_service_id"
        )
        .leftJoinAndSelect(
          HardwareMasterEntity,
          "hardwareMasterEntity",
          "hardwareMasterEntity.id = model.accelerator_id"
        )
        .where("model.id = :id", { id: param.id })
        .andWhere("model.is_delete = :is_delete", { is_delete: 0 })
        .select([
          "model.id AS id",
          "model.company_id AS company_id",
          "model.member_id AS member_id",
          "model.model_id AS model_id",
          "model.name AS name",
          "model.description AS description",
          "model.model_category_id AS model_category_id",
          "model.cloud_provider_id AS cloud_provider_id",
          "model.train_configuration AS train_configuration",
          "model.model_task_type_id AS model_task_type_id",
          "model.dataset_configuration AS dataset_configuration",
          "model.request_id AS request_id",
          "model.job_id AS job_id",
          "model.execution_time AS execution_time",
          "model.status AS status",
          "model.is_delete AS is_delete",
          "model.created_at AS created_at",
          "model.infra_detail AS infra_detail",
          "model.evaluation_details AS evaluation_details",
          "model.deployment_details AS deployment_details",
          "model.status_log AS status_log",
          "modelCategory.name AS model_category_name",
          "modelTaskEntity.name AS model_task_name",
          "members.full_name AS member_name",
          "members.profile_picture AS profile_picture",
          "modelentity.name AS model_name",
          "modelentity.model_train_configuration AS model_training_configuration",
          "modelentity.data_set_configuration AS model_dataset_configuration",

          // dataset details
          "datasetentity.id AS dataset_id",
          "datasetentity.name AS dataset_name",
          "datasetentity.description AS dataset_description",
          "datasetentity.type AS dataset_type",
          "datasetentity.data_format AS dataset_format",
          "datasetentity.dataset_path AS dataset_path",
          "sourceEntity.name AS source_name",

          "modelClassEntity.id AS model_class_id",
          "modelClassEntity.name AS model_class_name",
          "cloudAccountEntity.account_name AS cloud_provider_name",
          "hardwareMasterEntity.model_name AS accelerator_name",
          "model.training_type AS training_type",
          "datasetProvider.name AS dataset_source"
        ])
        .getRawOne();

      if (!query) {
        return Promise.reject('E10001');
      }

      if (query.evaluation_details && query.evaluation_details.dataset_id) {
        const evalDataSet = await DataSetEntity.findOneBy({ id: query.evaluation_details.dataset_id });
        if (evalDataSet && evalDataSet.dataset_path) {
          query.evaluation_details['eval_dataset_path'] = evalDataSet.dataset_path;
        }
      }

      let profilePictureUrl = query.profile_picture;
      if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
        try {
          profilePictureUrl = await this.generateSignedUrl('members', query.member_id, query.profile_picture);
        } catch (e) {
          console.error("Error generating signed URL for profile picture", e);
          profilePictureUrl = null;
        }
      }
      query.profile_picture = profilePictureUrl;

      // Enrich infra_detail with names
      if (query.infra_detail) {
        query.infra_detail = {
          node_count: query.infra_detail.node_count,
          accelerator_count: query.infra_detail.accelerator_count,
          cloud_account_name: query.cloud_provider_name || "",
          accelerator_name: query.accelerator_name || ""
        };
      }

      return query;
    } catch (error) {
      console.error("Error in prepareQueryById:", error);
      throw error;
    }
  }

  override transformModel(model: ModelTrainingModel): ModelTrainingModel {
    model.member_id = model.decryptToken.member_id;
    model.job_id = CryptoJS.SHA256(
      Date.now().toString() + Math.random().toString()
    ).toString();
    model.request_id = CryptoJS.SHA256(
      Date.now().toString() + Math.random().toString()
    ).toString();
    model.status = ModelTrainingStatus.PENDING;
    model.execution_time = 0;

    // Extract nested fields from infra_detail if present
    if (model.infra_detail) {
      if (model.infra_detail.accelerator_id) {
        model.accelerator_id = model.infra_detail.accelerator_id;
      }
      if (model.infra_detail.accelerator_count) {
        model.accelerator_count = model.infra_detail.accelerator_count;
      }
      if (model.infra_detail.cloud_account_id) {
        model.cloud_provider_id = model.infra_detail.cloud_account_id;
      }
    }

    return model;
  }

  async updateStatus(model: ModelTrainingModel): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const result = await this.entity.findOneBy({ id: model.id });
      if (result) {
        const STATUS_ORDER = [
          ModelTrainingStatus.PENDING,
          ModelTrainingStatus.QUEUED,
          ModelTrainingStatus.TRAINING_RECEIVED,
          ModelTrainingStatus.DOWNLOADING_DATA,
          ModelTrainingStatus.TRAINING_STARTED,
          ModelTrainingStatus.TRAINING_COMPLETED,
          ModelTrainingStatus.SAVING_WEIGHTS,
          ModelTrainingStatus.UPLOADING_WEIGHTS,
          ModelTrainingStatus.COMPLETED,
          ModelTrainingStatus.FAILED
        ];

        const currentStatusIndex = STATUS_ORDER.indexOf(result.status as ModelTrainingStatus);
        const incomingStatusIndex = STATUS_ORDER.indexOf(model.status as ModelTrainingStatus);

        // If both statuses are part of the known progression, ignore out-of-order/older updates
        if (currentStatusIndex !== -1 && incomingStatusIndex !== -1 && incomingStatusIndex <= currentStatusIndex) {
          console.log(`[ModelTrainingService] Ignoring older out-of-order status update for training ${model.id}: ${model.status} <= ${result.status}`);
          return resolve("Ignored older status update");
        }

        const currentLog = result.status_log || [];
        const logEntry = {
          status: model.status,
          timestamp: new Date().toISOString()
        };

        const updateData: any = {
          status: model.status,
          status_log: [...currentLog, logEntry]
        };

        if (model.status === ModelTrainingStatus.COMPLETED || (model.status as string) === 'COMPLETED') {
          const currentTime = new Date().getTime();
          const startTime = new Date(result.created_at).getTime();
          const executionTimeSeconds = Math.floor((currentTime - startTime) / 1000);
          updateData.execution_time = executionTimeSeconds;
          console.log(`[ModelTrainingService] Training ${model.id} COMPLETED. Execution time: ${executionTimeSeconds}s`);
        } else if (model.status === ModelTrainingStatus.FAILED || (model.status as string) === 'FAILED') {
          updateData.execution_time = 0;
          console.log(`[ModelTrainingService] Training ${model.id} FAILED. Execution time set to 0.`);
        }

        await this.entity.update({ id: model.id }, updateData);
        const updatedResult = await this.entity.findOneBy({ id: model.id });

        if ((model.status === ModelTrainingStatus.FAILED || (model.status as string) === 'FAILED') && result.status !== ModelTrainingStatus.FAILED) {
          await AuditLogService.logFailureIncident({
            company_id: updatedResult.company_id,
            member_id: updatedResult.member_id,
            module: this.getModuleName(),
            entity_type: 'ModelTrainingEntity',
            entity_id: updatedResult.id,
            entity_name: updatedResult.name,
            description: `Model Training ${updatedResult.name} failed`,
            reason: model.latest_kafka_message,
            metadata: {
              kafka_payload: model.latest_kafka_message,
              previous_status: result.status,
              current_status: model.status,
            },
          });
        }

        // Cost Calculation and Reporting
        if ((model.status === ModelTrainingStatus.COMPLETED || (model.status as string) === 'COMPLETED') && updatedResult.execution_time > 0) {
          try {
            const psec = await PricingService.getPricePerSec(result.company_id, result.accelerator_id);
            const totalCost = updatedResult.execution_time * psec;

            const costPayload = {
              company_id: result.company_id,
              member_id: result.member_id,
              module: "Training",
              execution_time: updatedResult.execution_time,
              price_per_sec: psec,
              total_cost: totalCost,
              resource_id: result.id,
              accelerator_id: result.accelerator_id
            };

            console.log(`[ModelTrainingService] Reporting cost for training ${model.id}:`, costPayload);
            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, costPayload);
          } catch (costError) {
            console.error(`[ModelTrainingService] Error calculating/reporting cost for training ${model.id}:`, costError);
          }
        }

        await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.TRAINING,
          entity: updatedResult
        });

        // Send Notification for Status Change
        // const notificationModel = new NotificationModel();
        // notificationModel.user_id = updatedResult.member_id;
        // const member = await MembersEntity.findOneBy({ id: updatedResult.member_id });
        // const userName = member ? member.full_name : 'User';
        // const modelTrainingName = updatedResult.name;
        // const statusText = model.status === ModelTrainingStatus.COMPLETED ? 'completed successfully' : 'failed';
        // notificationModel.message = `Training ${modelTrainingName} ${statusText}`;
        // notificationModel.notification_type = NotificationType.UPDATED;
        // notificationModel.module_name = ModuleType.TRAINING;
        // notificationModel.is_readed = false;
        // notificationModel.company_id = updatedResult.company_id;
        // await this.notificationService.createRecord(notificationModel, null);
        const allowedStatuses = [
          ModelTrainingStatus.COMPLETED,
          ModelTrainingStatus.FAILED,
          ModelTrainingStatus.TRAINING_STARTED,
        ];

        if (allowedStatuses.includes(model.status)) {
          const statusMessages: Record<string, string> = {
            [ModelTrainingStatus.COMPLETED]: "completed successfully",
            [ModelTrainingStatus.FAILED]: "failed",
            [ModelTrainingStatus.TRAINING_STARTED]: "started",
          };

          const notificationModel = new NotificationModel();
          notificationModel.user_id = updatedResult.member_id;
          const member = await MembersEntity.findOneBy({ id: updatedResult.member_id });
          const modelTrainingName = updatedResult.name;
          const statusText = statusMessages[model.status];

          notificationModel.message = `Training ${modelTrainingName} ${statusText}`;
          notificationModel.notification_type = NotificationType.UPDATED;
          notificationModel.module_name = ModuleType.TRAINING;
          notificationModel.is_readed = false;
          notificationModel.company_id = updatedResult.company_id;
          await this.notificationService.createRecord(notificationModel, null);
        }

        resolve("Model Training Status Updated Successfully");
      } else {
        reject("E10029");
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
              entity_type: 'ModelTrainingEntity',
              entity_id: model.id,
              entity_name: model.name,
              description: `Model Training ${model.name} was deleted`,
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

export default ModelTrainingService;
