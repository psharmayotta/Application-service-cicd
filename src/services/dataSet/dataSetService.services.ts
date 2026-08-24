import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { DataSetEntity } from "../../entities/dataSetEntity";
import { DataSetModel } from "../../database/repository/dataSet/dataset.model";
import { DataSetDto } from "../../database/repository/dataSet/dataSet.dto";
import { MetaModel } from "../../core/MetaModel";
import {
  AWS_S3_FOLDER_NAME,
  ModelTrainingStatus,
  MODELTRAININGURL,
  DatasetStatus,
  KAFKAPRODUCERS,
  ModuleType,
  NotificationType,
  WalletTxnReferenceType,
} from "../../config";
import axios from "axios";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { CloudServicesEntity } from "../../entities/cloudServiceEntity";
import { Pagination } from "../../core/InferParams";
import ModelTrainingService from "../modelTraining/modelTrainingService.services";
import { ModelTrainingDto } from "../../database/repository/modelTraining/modelTraining.dto";
import { ModelTrainingModel } from "../../database/repository/modelTraining/modelTraining.model";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import CloudSecretsService from "../cloudSecrets/cloudSecretsService.service";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import AuditLogService from "../auditLog/auditLogService.services";

class DataSetService extends BaseServices {
  constructor(
    entity: any = DataSetEntity,
    protected awsService: AwsService = new AwsService(),
    protected notificationService: NotificationService = new NotificationService()
  ) {
    super(entity, awsService);
  }

  getModel(): DataSetModel {
    return new DataSetModel();
  }

  getDTO() {
    return DataSetDto;
  }

  getModuleName(): string {
    return 'Dataset';
  }

  getMetaModel(): MetaModel {
    return new MetaModel("dataSet", "dataset_file", [
      {
        fileKey: "dataset_file",
        allowedSize: 5767168,
        require: "true",
        allowedExtensions: [
          "application/csv",
          "application/vnd.ms-excel",
          "image/png",
          "image/jpg",
          "image/jpeg",
          "image/webp",
        ],
        colName: "dataset_path",
      },
    ]);
  }

  override transformModel(model: DataSetModel): DataSetModel {
    model.member_id = model.decryptToken.member_id;
    return model;
  }

  override async prepareQueryById(param: any): Promise<any> {
    if (!param.id || isNaN(Number(param.id))) {
      return Promise.reject('E10072');
    }

    const record = await this.entity.findOneBy({ id: Number(param.id), is_delete: 0 });
    if (!record) {
      return Promise.reject('E10073');
    }

    return record;
  }

  override async prepareQuery(param: Pagination): Promise<any> {
    try {
      const query = this.entity.createQueryBuilder("dataset")
        .leftJoinAndSelect(CloudProviderEntity, "cp", "cp.id = dataset.cloud_service_id")
        .leftJoinAndSelect(MembersEntity, "member", "member.id = dataset.member_id")
        .leftJoinAndSelect(ModelCategoryEntity, "category", "category.id = dataset.category_id")
        .select([
          "dataset.id as id",
          "dataset.name as dataset_name",
          "cp.name as model_source",
          "dataset.meta_data as examples",
          "member.full_name as created_by",
          "member.profile_picture as profile_picture",
          "dataset.created_at as created_at",
          "dataset.modified_at as modified_at",
          "dataset.download_status as download_status",
          "dataset.yotta_bucket_path as yotta_bucket_path",
          "dataset.member_id as member_id",
          "dataset.dataset_path as dataset_path",
          "dataset.type as dataset_type",
          "dataset.data_format as dataset_format",
          "dataset.size as size",
          "dataset.failure_message as reason",
          "dataset.status as status",
          "cp.id as cloud_provider_id",
          "cp.cloud_provider_image as cloud_provider_icon",
          "dataset.module_name as module_name",
          "dataset.category_id as category_id",
          "category.name as category_name"
        ])
        .where("dataset.company_id = :companyId", { companyId: param.company_id });

      if (param.is_delete !== undefined) {
        query.andWhere("dataset.is_delete = :isDelete", { isDelete: param.is_delete });
      } else {
        query.andWhere("dataset.is_delete = :isDelete", { isDelete: 0 });
      }

      if ((param as any).status) {
        let statuses: string[] = [];
        if (Array.isArray((param as any).status)) {
          statuses = (param as any).status.map((s: string) => s.trim().toLowerCase());
        } else if (typeof (param as any).status === 'string') {
          statuses = (param as any).status.split(',').map((s: string) => s.trim().toLowerCase());
        }

        if (statuses.length > 0) {
          query.andWhere("LOWER(dataset.status) IN (:...datasetStatuses)", { datasetStatuses: statuses });
        }
      }

      if (param.search_text) {
        const searchText = `%${param.search_text.toLowerCase()}%`;
        query.andWhere(
          "(LOWER(dataset.name) LIKE :search OR LOWER(cp.name) LIKE :search OR LOWER(member.full_name) LIKE :search)",
          { search: searchText }
        );
      }

      if ((param as any).module_name) {
        query.andWhere("dataset.module_name = :moduleName", { moduleName: (param as any).module_name });
      }

      if ((param as any).category_id) {
        query.andWhere("dataset.category_id = :categoryId", { categoryId: (param as any).category_id });
      }

      query.orderBy("dataset.id", "DESC");

      if (param.pageNumber && param.pageSize) {
        const offset = (param.pageNumber - 1) * param.pageSize;
        query.offset(offset);
        query.limit(param.pageSize);
      }

      const records = await query.getRawMany();

      const countQuery = this.entity.createQueryBuilder("dataset")
        .leftJoin(CloudProviderEntity, "cp", "cp.id = dataset.cloud_service_id")
        .leftJoin(MembersEntity, "member", "member.id = dataset.member_id")
        .where("dataset.company_id = :companyId", { companyId: param.company_id });

      if (param.is_delete !== undefined) {
        countQuery.andWhere("dataset.is_delete = :isDelete", { isDelete: param.is_delete });
      } else {
        countQuery.andWhere("dataset.is_delete = :isDelete", { isDelete: 0 });
      }

      if ((param as any).status) {
        let statuses: string[] = [];
        if (Array.isArray((param as any).status)) {
          statuses = (param as any).status.map((s: string) => s.trim().toLowerCase());
        } else if (typeof (param as any).status === 'string') {
          statuses = (param as any).status.split(',').map((s: string) => s.trim().toLowerCase());
        }

        if (statuses.length > 0) {
          countQuery.andWhere("LOWER(dataset.status) IN (:...datasetStatuses)", { datasetStatuses: statuses });
        }
      }

      if (param.search_text) {
        const searchText = `%${param.search_text.toLowerCase()}%`;
        countQuery.andWhere(
          "(LOWER(dataset.name) LIKE :search OR LOWER(cp.name) LIKE :search OR LOWER(member.full_name) LIKE :search)",
          { search: searchText }
        );
      }

      if ((param as any).module_name) {
        countQuery.andWhere("dataset.module_name = :moduleName", { moduleName: (param as any).module_name });
      }

      if ((param as any).category_id) {
        countQuery.andWhere("dataset.category_id = :categoryId", { categoryId: (param as any).category_id });
      }

      const total = await countQuery.getCount();

      const formattedRecords = await Promise.all(records.map(async (record) => {
        let profilePictureUrl = record.profile_picture;
        if (profilePictureUrl && !profilePictureUrl.startsWith('http')) {
          try {
            profilePictureUrl = await this.generateSignedUrl('members', record.member_id, record.profile_picture);
          } catch (e) {
            console.error("Error generating signed URL for profile picture", e);
            profilePictureUrl = null;
          }
        }

        let cloudProviderIconUrl = record.cloud_provider_icon;
        if (cloudProviderIconUrl) {
          try {
            cloudProviderIconUrl = await this.generateSignedUrl('cloudProviderMedia', record.cloud_provider_id, record.cloud_provider_icon);
          } catch (e) {
            console.error("Error generating signed URL for cloud provider icon", e);
            cloudProviderIconUrl = null;
          }
        }

        return {
          id: record.id,
          dataset_name: record.dataset_name,
          model_source: record.model_source,
          examples: record.examples,
          created_by: record.created_by,
          profile_picture: profilePictureUrl,
          created_at: record.created_at,
          modified_at: record.modified_at,
          dataset_path: record.dataset_path,
          dataset_type: record.dataset_type,
          dataset_format: record.dataset_format,
          size: record.size,
          reason: record.reason,
          status: record.status,
          cloud_provider_icon: cloudProviderIconUrl,
          module_name: record.module_name,
          category_id: record.category_id,
          category_name: record.category_name
        };
      }));

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

  override async transformFileData(
    model: DataSetModel,
    files: any
  ): Promise<any> {
    try {
      let fileData = null;
      if (files.length > 0) {
        fileData = {
          ...model,
          dataset_path: `${AWS_S3_FOLDER_NAME}/${this.getMetaModel()?.modelName
            }/${model.id}/${files[0].dataset_file}`,
        };
      } else {
        fileData = {
          ...model,
          files,
        };
      }

      return Promise.resolve(fileData);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  override async createPostProcess(result: DataSetModel, model: DataSetModel, files: any): Promise<DataSetModel> {
    return new Promise(async (resolve, reject) => {
      try {
        const [cloudServiceEntity, cloudSecretsEntity] = await Promise.all([
          CloudProviderEntity.findOneBy({ id: result.cloud_service_id }),
          result.cloud_secret_id ? CloudSecretsEntity.findOneBy({ id: result.cloud_secret_id }) : Promise.resolve(null)
        ]);

        const payload = {
          dataset_id: result.id,
          org_id: result.company_id,
          member_id: result.member_id,
          dataset_name: result.name,
          source: cloudServiceEntity ? cloudServiceEntity.name : "",
          dataset_path: result.dataset_path,
          dataset_configuration: cloudSecretsEntity ? cloudSecretsEntity.secrets : {},
        };

        // Track secret usage
        if (result.cloud_secret_id) {
          CloudSecretsService.updateSecretLastUsed(result.cloud_secret_id, 'Dataset');
        }

        // Update status to inprogress
        if (cloudServiceEntity && cloudServiceEntity.name.toLowerCase() === 'file upload') {
          await this.entity.update(
            { id: result.id },
            {
              status: DatasetStatus.SUCCESS,
              yotta_bucket_path: result.dataset_path,
              download_status: true
            }
          );
          result.status = DatasetStatus.SUCCESS;
          result.yotta_bucket_path = result.dataset_path;
          result.download_status = true;
        } else {
          await this.entity.update({ id: result.id }, { status: DatasetStatus.UPLOADING });
          await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.DATASETINIT, payload);
        }

        await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.DATASET,
          entity: result
        });

        // Send Notification
        const notificationModel = new NotificationModel();
        notificationModel.user_id = result.member_id;
        const member = await MembersEntity.findOneBy({ id: result.member_id });
        const userName = member ? member.full_name : 'User';
        notificationModel.message = `${userName} created a new Dataset`;
        notificationModel.notification_type = (cloudServiceEntity && cloudServiceEntity.name.toLowerCase() === 'file upload') ? NotificationType.SUCCESS : NotificationType.ADDED;
        notificationModel.module_name = ModuleType.DATASET;
        notificationModel.is_readed = false;
        notificationModel.company_id = result.company_id;
        const notificationRecord = await this.notificationService.createRecord(notificationModel, null);


        WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.NOTIFICATION,
          entity: {
            ...notificationRecord,
            user_name: member ? member.full_name : ''
          }
        });
        await AuditLogService.log({
          company_id: result.company_id,
          member_id: result.member_id,
          module: this.getModuleName(),
          action: 'CREATE',
          entity_type: 'DataSetEntity',
          entity_id: result.id,
          entity_name: result.name,
          description: `Dataset ${result.name} was created`,
          ip_address: '',
        });

        resolve(result);
      } catch (error) {
        console.error("Error in createPostProcess:", error);
        resolve(result);
      }
    });
  }

  async updateStatus(model: DataSetModel): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const result = await this.entity.findOneBy({ id: model.id });
      if (!result) {
        return reject('E10029');
      }
      const previousStatus = result.status;
      await this.entity.update(
        { id: model.id },
        {
          download_status: model.download_status,
          yotta_bucket_path: model.yotta_bucket_path,
          size: model.size,
          failure_message: model.failure_message,
          status: model.status
        }
      );

      result.download_status = model.download_status;
      result.yotta_bucket_path = model.yotta_bucket_path;
      result.size = model.size;
      result.failure_message = model.failure_message;
      result.status = model.status;

      await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
        module: ModuleType.DATASET,
        entity: result,
      });

      if (model.status === DatasetStatus.FAILED && previousStatus !== DatasetStatus.FAILED) {
        await AuditLogService.logFailureIncident({
          company_id: result.company_id,
          member_id: result.member_id,
          module: this.getModuleName(),
          entity_type: 'DataSetEntity',
          entity_id: result.id,
          entity_name: result.name,
          description: `Dataset ${result.name} failed`,
          reason: model.failure_message,
          metadata: {
            previous_status: previousStatus,
            current_status: model.status,
          },
        });
      }

      // Send Notification for Status Change
      if (model.status === DatasetStatus.SUCCESS || model.status === DatasetStatus.FAILED || model.status === DatasetStatus.PENDING) {
        const notificationModel = new NotificationModel();
        notificationModel.user_id = result.member_id;
        const member = await MembersEntity.findOneBy({ id: result.member_id });
        const userName = member ? member.full_name : 'User';

        let statusText = 'is created';
        let notificationType = NotificationType.ADDED;
        if (model.status === DatasetStatus.SUCCESS) {
          statusText = 'uploaded successfully';
          notificationType = NotificationType.SUCCESS;
        } else if (model.status === DatasetStatus.FAILED) {
          statusText = 'failed to upload';
          notificationType = NotificationType.FAILED;
        }

        notificationModel.message = `Dataset ${result.name} ${statusText}`;
        notificationModel.notification_type = notificationType;
        notificationModel.module_name = ModuleType.DATASET;
        notificationModel.is_readed = false;
        notificationModel.company_id = result.company_id;
        const notificationRecord = await this.notificationService.createRecord(notificationModel, null);


        WebSocketService.pushMessageToCompany(result.company_id.toString(), {
          module: ModuleType.NOTIFICATION,
          entity: {
            ...notificationRecord,
            user_name: member ? member.full_name : ''
          }
        });
      }

      resolve("Data Set Status Updated Successfully");
    });
  }

  public override updateDeleteFlagData = async (param: any): Promise<boolean> => {
    try {
      if (!param.id) {
        throw 'E10072';
      }
      const whereid = await this.updateDeleteFlagPreProcess(param);
      if (whereid === null) {
        throw 'E10072';
      }

      const records = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
      if (!records || records.length === 0) {
        throw 'E10073';
      }

        await this.entity.update({ id: whereid }, { is_delete: 1 });

        for (const record of records) {
          // 1. Trigger final billing calculation in Utility Service
          try {
            const costPayload = {
              company_id: record.company_id,
              member_id: param.decryptToken?.member_id || record.member_id,
              module: WalletTxnReferenceType.DATASET,
              entity_id: record.id,
              request: {
                dataset_id: record.id,
                size: record.size,
                action: 'DELETE',
                success_time: record.modified_at
              }
            };
            console.log(`[Dataset Delete] Triggering final billing for dataset ${record.id}:`, costPayload);
            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.CREDITCALCULATE, costPayload);
          } catch (billingError) {
            console.error(`[Dataset Delete] Failed to trigger final billing for dataset ${record.id}:`, billingError);
          }

          try {
            const deletePayload = {
              dataset_id: record.id,
              org_id: record.company_id,
              member_id: parseInt(param.decryptToken?.member_id || record.member_id),
              action: 'DELETE'
            };
            console.log(`[Dataset Delete] Triggering S3 deletion via DATASETINIT for dataset ${record.id}:`, deletePayload);
            await KafkaService.getInstance().sendMessage(KAFKAPRODUCERS.DATASETINIT, deletePayload);
          } catch (infraError) {
            console.error(`[Dataset Delete] Failed to trigger S3 deletion for dataset ${record.id}:`, infraError);
          }

          // 3. Log audit log
          try {
            await AuditLogService.log({
              company_id: record.company_id,
              member_id: param.decryptToken?.member_id || record.member_id,
              module: this.getModuleName(),
              action: 'DELETE',
              entity_type: 'DataSetEntity',
              entity_id: record.id,
              entity_name: record.name,
              description: `Dataset ${record.name} was deleted`,
              ip_address: param.ip_address || '',
            });
          } catch (auditError) {
            console.error(`[Dataset Delete] Failed to log audit log for dataset ${record.id}:`, auditError);
          }
        }
        return true;
    } catch (e) {
      throw e;
    }
  }

  async restoreData(param: any): Promise<boolean> {
    try {
      if (!param.id || isNaN(Number(param.id))) {
        return Promise.reject('E10072');
      }

      const result = await this.entity.findOne({
        where: { id: Number(param.id), is_delete: 1 },
        withDeleted: true
      });

      if (result) {
        await this.entity.update({ id: Number(param.id) }, { is_delete: 0 });
        return Promise.resolve(true);
      } else {
        return Promise.reject('E10073');
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

export default DataSetService;
