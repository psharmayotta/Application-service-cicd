import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ChatFilter, CloudFilter } from "../../core/InferParams";
import {
  DeploymentStatus,
  KAFKAPRODUCERS,
  DEPLOYMENTPROCESS,
  NodeAntiAffinity,
  MODEL_ENDPOINT_URL,
  InfraAllocationModuleType,
  QuotaStatus,
  DeploymentType,
  ModuleTypeQuota,
} from "../../config";
import { InfraNodesEntity } from "../../entities/infraNodesEntity";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { DeploymentModel } from "../../database/repository/deployment/deployment.model";
import { DeploymentDto } from "../../database/repository/deployment/deployment.dto";
import { ModelEntity } from "../../entities/modelEntity";
import { ClustersEntity } from "../../entities/clusterEntity";
import { HardwareSpecsEntity } from "../../entities/hardwareSpecsEntity";
import { MembersEntity } from "../../entities/membersEntity";
import { InfraHardwareModuleMapperEntity } from "../../entities/infraHardwareModuleMapperEntity";
import { InfraModuleEntity } from "../../entities/infraModuleEntity";
import { ModelAPIDetailsEntity } from "../../entities/modelApiDetailsEntity";
import { ApiKeyTokenEntity } from "../../entities/apiKeyTokenEntity";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { PodDetailsEntity } from "../../entities/podDetails";
import CryptoJS from "crypto-js";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { QuantizationEntity } from "../../entities/quantizationEntity";
import { DeploymentKbIntegrationEntity } from "../../entities/deploymentKbIntegrationEntity";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import { CloudAccountEntity } from "../../entities/cloudAccountEntity";
import { CloudRegionEntity } from "../../entities/cloudRegionEntity";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { KnowledgeBaseEntity } from "../../entities/knowledgeBaseEntity";
import { NimModelEntity } from "../../entities/nimModelEntity";

import { NodeGroupsEntity } from "../../entities/nodeGroupsEntity";
import { In, IsNull, Brackets } from "typeorm";
import { ModuleType, NotificationType } from "../../config";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import DeploymentQuotaService from "../quota/deploymentQuotaService.service";
import { DeploymentQuotaModel } from "../../database/repository/quota/deploymentQuota.model";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import AuditLogService from "../auditLog/auditLogService.services";

class DeploymentService extends BaseServices {
  constructor(
    entity: any = InfraAllocationEntity,
    protected awsService: AwsService = new AwsService(),
    protected notificationService: NotificationService = new NotificationService()
  ) {
    super(entity, awsService);
  }

  getModel(): DeploymentModel {
    return new DeploymentModel();
  }

  getDTO() {
    return DeploymentDto;
  }

  getModuleName(): string {
    return "Deployment";
  }

  override async createPreProcess(model: DeploymentModel, _files: any): Promise<DeploymentModel> {
    try {
      if (model.deployment_type) {
        const moduleDetail = await InfraModuleEntity.findOneBy({
          name: model.deployment_type,
        });

        if (moduleDetail) {
          model.module_type_id = moduleDetail.id;
        }
      }
      return this.transformModel(model);
    } catch (error) {
      console.error('Error in DeploymentService createPreProcess:', error);
      throw error;
    }
  }

  override transformModel(model: DeploymentModel): DeploymentModel {
    model.user_id = model.decryptToken.member_id;
    if (!model.module_type_id) {
      model.module_type_id = 4;
    }
    if (!model.module_type) {
      model.module_type = InfraAllocationModuleType.DEPLOYMENT;
    }
    if (model.model_id) {
      model.module_id = model.model_id;
    }
    if (!model.slug && model.deployment_name) {
      model.slug = model.deployment_name
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");
    }
    model.config = {
      description: model.description,
      gpu_type: model.gpu_type,
      cpu_cores: model.cpu_cores,
      gpu_count_per_pod: model.gpu_count_per_pod,
      node_groups: model.node_groups,
    };

    if (model.scaling) {
      const s = model.scaling;
      model.node_anti_affinity = s.node_anti_affinity
        ? NodeAntiAffinity.REQUIRED
        : NodeAntiAffinity.NOTREQUIRED;

      if (s.auto_scaling) {
        model.min_pod_count = s.auto_scaling.min_replicas;
        model.max_pod_count = s.auto_scaling.max_replicas;
        model.scaling_metric = s.auto_scaling.metrics;
        model.scaling_parameters = s.auto_scaling;
      }
    }

    return model;
  }

  createPostProcess(
    result: DeploymentModel,
    model: DeploymentModel,
    _files: any
  ): Promise<DeploymentModel> {
    return new Promise(async (resolve, reject) => {
      try {
        const rawDeploymentType = model.deployment_type ? model.deployment_type.toLowerCase() : undefined;
        const deploymentType = rawDeploymentType || DeploymentType.PLAYGROUND;

        if (deploymentType === DeploymentType.DOCKER) {
          const modelDetail = await ModelEntity.findOneBy({ id: result.module_id });
          let dockerKafkaPayload;
          if (modelDetail) {
            const nodeGroupNames = (model.node_groups && model.node_groups.length > 0)
              ? (await NodeGroupsEntity.findBy({ id: In(model.node_groups) })).map(ng => ng.name)
              : [];

            dockerKafkaPayload = {
              id: result.id,
              org_id: result.company_id,
              is_docker: true,
              model_id: result.module_id,
              name: modelDetail.name,
              cpu_request: modelDetail.cpu_request,
              cpu_limit: modelDetail.cpu_limit,
              memory_request: modelDetail.memory_request,
              memory_limit: modelDetail.memory_limit,
              gpu_count_per_pod: model.gpu_count_per_pod,
              node_groups: nodeGroupNames,
              node_group_names: nodeGroupNames,
              overall_configuration: modelDetail.overall_configuration || {},
              deployment_name: result.deployment_name,
              slug: result.slug,
              scaling_parameters: result.scaling_parameters || null,
              process: DEPLOYMENTPROCESS.CREATE,
              cluster_id: result.cluster_id,
              deployment_type: 'docker',
              environment: process.env.NODE_ENV || 'dev',
            };

            console.log("[dev-deployment-init]:", dockerKafkaPayload);
          }

          // Send Notification
          const notificationModel = new NotificationModel();
          notificationModel.user_id = result.user_id;
          notificationModel.company_id = result.company_id;
          const member = await MembersEntity.findOneBy({ id: result.user_id });
          const userName = member ? member.full_name : 'User';
          notificationModel.message = `${userName} created a new Deployment - ${result.deployment_name}`;
          notificationModel.notification_type = NotificationType.CREATED;
          notificationModel.module_name = ModuleType.DEPLOYMENT;
          notificationModel.is_readed = false;
          await this.notificationService.createRecord(notificationModel, null);

          // Create Default Quota
          try {
            const quotaService = new DeploymentQuotaService();
            const quotaModel = new DeploymentQuotaModel();
            quotaModel.model_id = result.id;
            quotaModel.company_id = result.company_id;
            quotaModel.requested_by = result.user_id;
            quotaModel.tpm_limit = 1000000;
            quotaModel.rpm_limit = 1000;
            quotaModel.status = QuotaStatus.APPROVED;
            quotaModel.is_default = 1;
            quotaModel.module_type = ModuleTypeQuota.DEPLOYMENT;
            await quotaService.createRecord(quotaModel, null);
          } catch (quotaError) {
            console.error("Error creating default quota for deployment:", quotaError);
          }
          const kafkaService = KafkaService.getInstance();
          await kafkaService.sendMessage(KAFKAPRODUCERS.DEPLOYMENT, dockerKafkaPayload);

          resolve(result);
        } else if (deploymentType === DeploymentType.NIM) {
          // NIM (NVIDIA NIM) deployment: model_id refers to nim_model.id
          const nimModel = await NimModelEntity.findOneBy({ id: result.module_id, is_delete: 0 });
          let nimKafkaPayload: any = null;

          if (nimModel) {
            const nodeGroupNames = (model.node_groups && model.node_groups.length > 0)
              ? (await NodeGroupsEntity.findBy({ id: In(model.node_groups) })).map(ng => ng.name)
              : [];

            nimKafkaPayload = {
              id: result.id,
              org_id: result.company_id,
              is_nim: true,
              nim_model_id: nimModel.id,
              name: nimModel.name,
              image: nimModel.image,
              publisher: nimModel.publisher,
              category: nimModel.category,
              gpu_count_per_pod: model.gpu_count_per_pod,
              node_groups: nodeGroupNames,
              node_group_names: nodeGroupNames,
              deployment_name: result.deployment_name,
              slug: result.slug,
              scaling_parameters: result.scaling_parameters || null,
              process: DEPLOYMENTPROCESS.CREATE,
              cluster_id: result.cluster_id,
              deployment_type: 'nim',
              environment: process.env.NODE_ENV || 'dev',
            };

            console.log("[dev-deployment-init] NIM:", nimKafkaPayload);
          }

          // Send Notification
          const notificationModel = new NotificationModel();
          notificationModel.user_id = result.user_id;
          notificationModel.company_id = result.company_id;
          const member = await MembersEntity.findOneBy({ id: result.user_id });
          const userName = member ? member.full_name : 'User';
          notificationModel.message = `${userName} created a new NIM Deployment - ${result.deployment_name}`;
          notificationModel.notification_type = NotificationType.CREATED;
          notificationModel.module_name = ModuleType.DEPLOYMENT;
          notificationModel.is_readed = false;
          await this.notificationService.createRecord(notificationModel, null);

          // Create Default Quota
          try {
            const quotaService = new DeploymentQuotaService();
            const quotaModel = new DeploymentQuotaModel();
            quotaModel.model_id = result.id;
            quotaModel.company_id = result.company_id;
            quotaModel.requested_by = result.user_id;
            quotaModel.tpm_limit = 1000000;
            quotaModel.rpm_limit = 1000;
            quotaModel.status = QuotaStatus.APPROVED;
            quotaModel.is_default = 1;
            quotaModel.module_type = ModuleTypeQuota.DEPLOYMENT;
            await quotaService.createRecord(quotaModel, null);
          } catch (quotaError) {
            console.error("Error creating default quota for NIM deployment:", quotaError);
          }

          const kafkaService = KafkaService.getInstance();
          await kafkaService.sendMessage(KAFKAPRODUCERS.DEPLOYMENT, nimKafkaPayload);

          await AuditLogService.log({
            company_id: result.company_id,
            member_id: result.user_id,
            module: this.getModuleName(),
            action: 'CREATE',
            entity_type: 'DeploymentEntity',
            entity_id: result.id,
            entity_name: result.deployment_name,
            description: `NIM Deployment ${result.deployment_name} was created with image ${nimModel?.image}`,
            ip_address: '',
          });

          resolve(result);
        } else {
          let modelDetail: any;
          let modelClass: string | undefined;
          let finalModelName: string;
          let targetModelId: number;

          switch (deploymentType) {
            case DeploymentType.TRAINING:
              const trainingModel = await ModelTrainingEntity.findOneBy({ id: result.module_id });
              if (trainingModel) {
                modelDetail = await ModelEntity.findOneBy({ id: trainingModel.model_id });
                finalModelName = modelDetail ? modelDetail.name : undefined;
                targetModelId = trainingModel.id;
                modelClass = modelDetail?.model_class_id
                  ? (await ModelClassEntity.findOneBy({ id: modelDetail.model_class_id }))?.name
                  : undefined;
              }
              break;
            case DeploymentType.PLAYGROUND:
              modelDetail = await ModelEntity.findOneBy({ id: result.module_id });
              finalModelName = modelDetail ? modelDetail.name : undefined;
              targetModelId = modelDetail ? modelDetail.id : undefined;
              modelClass = modelDetail?.model_class_id
                ? (await ModelClassEntity.findOneBy({ id: modelDetail.model_class_id }))?.name
                : undefined;
              break;
            case DeploymentType.MYMODEL:
              modelDetail = await ModelEntity.findOneBy({ id: result.module_id });
              let baseModelDetail = modelDetail;
              if (modelDetail && modelDetail.model_class_id) {
                const baseModel = await ModelEntity.findOne({
                  where: {
                    model_class_id: modelDetail.model_class_id,
                    company_id: IsNull(),
                    member_id: IsNull(),
                    is_delete: 0
                  }
                });
                if (baseModel) {
                  baseModelDetail = baseModel;
                }
              }
              finalModelName = baseModelDetail ? baseModelDetail.name : undefined;
              targetModelId = modelDetail ? modelDetail.id : undefined;
              modelClass = modelDetail?.model_class_id
                ? (await ModelClassEntity.findOneBy({ id: modelDetail.model_class_id }))?.name
                : undefined;
              break;
          }

          const request: any = {
            id: result.id,
            org_id: result.company_id,
            model_id: targetModelId,
            model_name: finalModelName,
            model_class: modelClass,
            deployment_name: result.deployment_name,
            slug: result.slug,
            scaling_parameters: result.scaling_parameters,
            cpu_cores: model.cpu_cores,
            gpu_count_per_pod: model.gpu_count_per_pod,
            node_groups: model.node_groups,
            node_group_names: (model.node_groups && model.node_groups.length > 0)
              ? (await NodeGroupsEntity.findBy({ id: In(model.node_groups) })).map(ng => ng.name)
              : [],
            deployment_type: null,
            process: DEPLOYMENTPROCESS.CREATE,
            cluster_id: result.cluster_id,
            quantization: null,
            inference_engine: result.inference_engine,
          };
          if (model.deployment_type) {
            request.deployment_type = model.deployment_type;
          }
          if (request.deployment_type !== DeploymentType.PLAYGROUND && modelDetail && modelDetail.quantization_id) {
            const quantization = await QuantizationEntity.findOneBy({
              id: modelDetail.quantization_id,
            });
            if (quantization) request.quantization = quantization.name;
          }

          const kafkaService = KafkaService.getInstance();
          await kafkaService.sendMessage(request.deployment_type === DeploymentType.TRAINING ? KAFKAPRODUCERS.COMPILEINIT : KAFKAPRODUCERS.DEPLOYMENT, request);

          // Send Notification
          const notificationModel = new NotificationModel();
          notificationModel.user_id = result.user_id;
          notificationModel.company_id = result.company_id;
          const member = await MembersEntity.findOneBy({ id: result.user_id });
          const userName = member.full_name;
          notificationModel.message = `${userName} created a new Deployment - ${result.deployment_name}`;
          notificationModel.notification_type = NotificationType.CREATED;
          notificationModel.module_name = ModuleType.DEPLOYMENT;
          notificationModel.is_readed = false;
          await this.notificationService.createRecord(notificationModel, null);

          // Create Default Quota
          try {
            const quotaService = new DeploymentQuotaService();
            const quotaModel = new DeploymentQuotaModel();
            quotaModel.model_id = result.id;
            quotaModel.company_id = result.company_id;
            quotaModel.requested_by = result.user_id;
            quotaModel.tpm_limit = 1000000;
            quotaModel.rpm_limit = 1000;
            quotaModel.status = QuotaStatus.APPROVED;
            quotaModel.is_default = 1;
            quotaModel.module_type = ModuleTypeQuota.DEPLOYMENT;
            await quotaService.createRecord(quotaModel, null);
          } catch (quotaError) {
            console.error("Error creating default quota for deployment:", quotaError);
          }

          await AuditLogService.log({
            company_id: result.company_id,
            member_id: result.user_id,
            module: this.getModuleName(),
            action: 'CREATE',
            entity_type: 'DeploymentEntity',
            entity_id: result.id,
            entity_name: result.deployment_name,
            description: `Deployment ${result.deployment_name} was created`,
            ip_address: '',
          });

          resolve(result);
        }
      } catch (error) {
        console.log("---DeploymentService createPostProcess----", error);
        reject(error);
      }
    });
  }

  override prepareQuery(param: ChatFilter): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!param.company_id) reject("E10020");

        let skip = null;
        if (param.pageNumber > 0) {
          skip = (param.pageNumber - 1) * param.pageSize;
        }

        const qb = this.entity
          .createQueryBuilder("ia")
          .select([
            "ia.id as id",
            "ia.created_at as created_at",
            "ia.node_id as node_id",
            "ia.module_id as model_id",
            "ia.user_id as user_id",
            "ia.company_id as company_id",
            "ia.module_type_id as module_type_id",
            "ia.deployment_name as deployment_name",
            "ia.slug as slug",
            "ia.cluster_id as cluster_id",
            "ia.scaling_parameters as scaling_parameters",
            "ia.rapid_autoscaling as rapid_autoscaling",
            "ia.is_delete as is_delete",
            "pd.status as status",
            "CASE WHEN ia_mod.name = 'training' THEN mt.name WHEN ia_mod.name = 'nim' THEN nm.name ELSE m.name END as model_name",
            "m.is_docker as is_docker",
            "CASE WHEN ia_mod.name = 'training' THEN bm.name ELSE NULL END as base_model",
            "m.accelerator_count as accelerator_count",
            "m.model_unique_key as model_unique_key",
            "in.hostname as hostname",
            "c.cluster_name as cluster_name",
            "hm.model_name as accelerator_name",
            "me.full_name as full_name",
            "me.email as email",
            "me.profile_picture as profile_picture",
            "ia.config as config",
            "m.playground_config as playground_config",
            "COALESCE(bm.enable_grpc, m.enable_grpc, false) as enable_grpc",
            "(SELECT mtt.name FROM model.model_task mtt WHERE mtt.id = COALESCE(m.model_task_id, bm.model_task_id) LIMIT 1) as task_name",
            "mp.model_provider_icon as model_provider_icon",
            "mp.id as model_provider_id",
            "ia.inference_engine as inference_engine",
          ])
          .leftJoin(InfraModuleEntity, "ia_mod", "ia_mod.id = ia.module_type_id")
          .leftJoin(ModelEntity, "m", "m.id = ia.module_id AND ia_mod.name NOT IN ('training', 'nim')")
          .leftJoin(ModelTrainingEntity, "mt", "mt.id = ia.module_id AND ia_mod.name = 'training'")
          .leftJoin(ModelEntity, "bm", "bm.id = CASE WHEN ia_mod.name = 'training' THEN mt.model_id ELSE (SELECT bm2.id FROM model.model bm2 WHERE bm2.model_class_id = m.model_class_id AND bm2.company_id IS NULL AND bm2.member_id IS NULL AND bm2.is_delete = 0 LIMIT 1) END")
          .leftJoin(NimModelEntity, "nm", "nm.id = ia.module_id AND ia_mod.name = 'nim'")
          .leftJoin(ModelProviderEntity, "mp", "mp.id = COALESCE(nm.model_provider_id, m.model_provider_id, bm.model_provider_id)")
          .leftJoin(InfraNodesEntity, "in", "in.id = ia.node_id")
          .leftJoin(ClustersEntity, "c", "c.id = ia.cluster_id")
          .leftJoin(HardwareSpecsEntity, "hs", "hs.id = COALESCE(m.accelerator_id, bm.accelerator_id)")
          .leftJoin(HardwareMasterEntity, "hm", "hm.id = hs.hardware_master_id")
          .leftJoin(MembersEntity, "me", "me.id = ia.user_id")
          .leftJoin(
            (subQuery) => {
              return subQuery
                .select("pd1.infra_allocation_id", "infra_allocation_id")
                .addSelect(
                  "(SELECT pd2.status FROM infra_schema.pod_details pd2 WHERE pd2.infra_allocation_id = pd1.infra_allocation_id AND pd2.is_delete = 0 ORDER BY CASE pd2.status WHEN 'READY' THEN 7 WHEN 'START' THEN 6 WHEN 'PENDING' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'PAUSED' THEN 3 WHEN 'DELETED' THEN 2 WHEN 'END' THEN 1 ELSE 0 END DESC, pd2.id DESC LIMIT 1)",
                  "status"
                )
                .from(PodDetailsEntity, "pd1")
                .where("pd1.is_delete = 0")
                .groupBy("pd1.infra_allocation_id");
            },
            "pd",
            "pd.infra_allocation_id = ia.id"
          )
          .where("ia.company_id = :company_id", {
            company_id: param.company_id,
          })
          .andWhere("ia.is_delete = :is_delete", {
            is_delete: param.is_delete,
          });

        if (param.model_id) {
          qb.andWhere("ia.module_id = :model_id", {
            model_id: param.model_id,
          });
        }
        if ((param as any).status) {
          const statusLower = (param as any).status.trim().toLowerCase();
          if (statusLower === 'paused' || statusLower === 'pause') {
            qb.andWhere("ia.status IN (:...statusVals)", { statusVals: ['PAUSED', 'PAUSE', 'END'] });
          } else if (statusLower === 'deployed' || statusLower === 'ready') {
            qb.andWhere("ia.status IN (:...statusVals)", { statusVals: ['READY', 'running'] });
          } else if (statusLower === 'pending') {
            qb.andWhere("(ia.status = :statusVal OR ia.status IS NULL)", { statusVal: 'PENDING' });
          } else if (statusLower === 'start' || statusLower === 'deploying') {
            qb.andWhere("ia.status IN (:...statusVals)", { statusVals: ['START', 'RESUMED', 'RESUME'] });
          } else {
            qb.andWhere("LOWER(ia.status) = :statusVal", { statusVal: statusLower });
          }
        }
        if ((param as any).model_task_id) {
          qb.andWhere(
            `(SELECT first_model.model_task_id 
              FROM model.model first_model 
              WHERE first_model.model_class_id = COALESCE(m.model_class_id, bm.model_class_id) 
                AND first_model.is_delete = 0
              ORDER BY first_model.id ASC 
              LIMIT 1) = :task_id`,
            { task_id: (param as any).model_task_id }
          );
        }
        if (param.search_text && param.search_text.trim() !== "") {
          qb.andWhere("LOWER(ia.deployment_name) LIKE :search", {
            search: `%${param.search_text.trim().toLowerCase()}%`,
          });
        }

        qb.orderBy("ia.created_at", "DESC").offset(skip).limit(param.pageSize);

        const [result, total] = await Promise.all([
          qb.getRawMany(),
          qb.getCount(),
        ]);

        const deploymentIds = result.map(item => item.id);
        let allKbs: any[] = [];
        if (deploymentIds.length > 0) {
          allKbs = await KnowledgeBaseEntity.createQueryBuilder("kb")
            .innerJoin(DeploymentKbIntegrationEntity, "dkbi", "dkbi.knowledge_base_id = kb.id")
            .where("dkbi.deployment_id IN (:...deploymentIds) AND dkbi.is_active = true AND dkbi.is_delete = 0 AND kb.is_delete = 0", { deploymentIds })
            .select(["kb.id as id", "kb.name as name", "dkbi.deployment_id as deployment_id"])
            .getRawMany();
        }

        const updatedResult = await Promise.all(result.map(async (item) => {
          const itemKbs = allKbs
            .filter(kb => kb.deployment_id === item.id)
            .map(kb => ({ id: kb.id, name: kb.name }));

          DeploymentService.processDeploymentStatus(item);


          let nodeGroupNames = [];
          const config = item.config;
          if (
            config &&
            config.node_groups &&
            Array.isArray(config.node_groups) &&
            config.node_groups.length > 0
          ) {
            try {
              const nodeGroups = await NodeGroupsEntity.findBy({
                id: In(config.node_groups),
              });
              nodeGroupNames = nodeGroups.map((ng) => ng.name);
            } catch (err) {
              console.error("Error fetching node group names in prepareQuery:", err);
            }
          }

          let playgroundConfig = item.playground_config;

          if (item.module_type_id === 3 && item.model_id) {
            const modelDetail = await ModelEntity.findOneBy({ id: item.model_id });
            if (modelDetail && modelDetail.model_class_id) {
              const baseModel = await ModelEntity.findOne({
                where: {
                  model_class_id: modelDetail.model_class_id,
                  company_id: IsNull(),
                  member_id: IsNull(),
                  is_delete: 0
                }
              });
              if (baseModel) {
                playgroundConfig = baseModel.playground_config;
              }
            }
          }

          if (item.model_provider_icon) {
            try {
              item.model_icon = await this.generateSignedUrl(
                "modelProviderMedia",
                item.model_provider_id,
                item.model_provider_icon
              );
            } catch (err) {
              console.error("Error generating signed URL for model provider icon:", err);
              item.model_icon = null;
            }
          } else {
            item.model_icon = null;
          }

          return {
            ...item,
            hashId: CryptoJS.MD5(item.id.toString()).toString(),
            status: item.status,
            node_group_names: nodeGroupNames,
            playground_config: playgroundConfig,
            knowledge_base_integrated: itemKbs
          }
        }));
        if (updatedResult.length > 0) {
          for (const rec of updatedResult) {
            if (rec.profile_picture) {
              const profilePic = rec.profile_picture;
              if (!profilePic || profilePic.trim() === "") {
                rec.profile_picture_signed_url = null;
              }
              else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                rec.profile_picture_signed_url = profilePic;
              }
              else {
                try {
                  const signedUrl = await this.generateSignedUrl(
                    "members",
                    rec.user_id,
                    profilePic
                  );
                  rec.profile_picture_signed_url = signedUrl;
                } catch {
                  rec.profile_picture_signed_url = null;
                }
              }
            }
          }
        }
        const pagination = {
          total,
          pageSize: param.pageSize,
          pageNumber: param.pageNumber,
        };

        resolve({
          data: updatedResult,
          pagination,
        });
      } catch (error) {
        console.log("---Clusters.prepareQuery--------", error);
        reject(error);
      }
    });
  }

  // fetch the details of deployment
  override prepareQueryById(param: CloudFilter): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.entity
          .createQueryBuilder("ia")
          .select([
            "ia.id as id",
            "ia.created_at as created_at",
            "ia.modified_at as modified_at",
            "ia.is_delete as is_delete",
            "ia.node_id as node_id",
            "ia.module_id as model_id",
            "ia.user_id as user_id",
            "ia.company_id as company_id",
            "ia.module_type_id as module_type_id",
            "ia.deployment_name as deployment_name",
            "ia.slug as slug",
            "ia.cluster_id as cluster_id",
            "ia.scaling_parameters as scaling_parameters",
            "ia.hardware_specs_id as hardware_specs_id",
            "ia.vram_size_gb as vram_size_gb",
            "ia.allocation_time as allocation_time",
            "ia.model_endpoint as model_endpoint",
            "ia.model_proxy as model_proxy",
            "ia.health_check_endpoint as health_check_endpoint",
            "ia.model_grpc as model_grpc",
            "CASE WHEN ia_mod.name = 'training' THEN mt.name WHEN ia_mod.name = 'nim' THEN nm.name ELSE m.name END as model_name",
            "m.is_docker as is_docker",
            "m.accelerator_count as accelerator_count",
            "m.model_unique_key as model_unique_key",
            "m.playground_config as playground_config",
            "COALESCE(bm.enable_grpc, m.enable_grpc, false) as enable_grpc",
            "(SELECT mtt.name FROM model.model_task mtt WHERE mtt.id = COALESCE(m.model_task_id, bm.model_task_id) LIMIT 1) as task_name",
            "nm.name as nim_model_name",
            "nm.image as nim_image",
            "nm.model_identifier as nim_model_identifier",
            "in.hostname as hostname",
            "c.cluster_name as cluster_name",
            "hm.model_name as accelerator_name",
            "me.full_name as full_name",
            "me.email as email",
            "me.profile_picture as profile_picture",
            "ihmm.assigned_core as accelerator_limit",
            "pd.infra_allocation_id as infra_allocation_id",
            "pd.pod_name as pod_name",
            "pd.namespace as namespace",
            "pd.status as pod_status",
            "pd.node_id as node_id",
            "pd.host_ip as host_ip",
            "pd.pod_ip as pod_ip",
            "pd.restart_count as restart_count",
            "pd.start_time as start_time",
            "pd.end_time as end_time",
            "pd.cpu_request as cpu_request",
            "pd.cpu_limit as cpu_limit",
            "pd.memory_request_mb as memory_request_mb",
            "pd.memory_limit_mb as memory_limit_mb",
            "pd.gpu_request as gpu_request",
            "pd.gpu_memory_mb as gpu_memory_mb",
            "pd.volume_mounts as volume_mounts",
            "pd.labels as labels",
            "pd.annotations as annotations",
            "pd.logs_path as logs_path",
            "ia.min_pod_count as min_pod_count",
            "ia.max_pod_count as max_pod_count",
            "ia.scaling_metric as scaling_metric",
            "ia.node_anti_affinity as node_anti_affinity",
            "ia.rapid_autoscaling as rapid_autoscaling",
            "ia.config as config",
            "CASE WHEN ia_mod.name = 'training' THEN bm.name ELSE NULL END as base_model",
            "mp.model_provider_icon as model_provider_icon",
            "mp.id as model_provider_id",
            "ia.inference_engine as inference_engine",
            "agg_pd.status as status",
          ])
          .leftJoin(InfraModuleEntity, "ia_mod", "ia_mod.id = ia.module_type_id")
          .leftJoin(ModelEntity, "m", "m.id = ia.module_id AND ia_mod.name NOT IN ('training', 'nim')")
          .leftJoin(ModelTrainingEntity, "mt", "mt.id = ia.module_id AND ia_mod.name = 'training'")
          .leftJoin(ModelEntity, "bm", "bm.id = mt.model_id")
          .leftJoin(NimModelEntity, "nm", "nm.id = ia.module_id AND ia_mod.name = 'nim'")
          .leftJoin(ModelProviderEntity, "mp", "mp.id = COALESCE(nm.model_provider_id, m.model_provider_id, bm.model_provider_id)")
          .leftJoin(InfraNodesEntity, "in", "in.id = ia.node_id")
          .leftJoin(ClustersEntity, "c", "c.id = ia.cluster_id")
          .leftJoin(HardwareSpecsEntity, "hs", "hs.id = m.accelerator_id")
          .leftJoin(HardwareMasterEntity, "hm", "hm.id = hs.hardware_master_id")
          .leftJoin(MembersEntity, "me", "me.id = ia.user_id")
          .leftJoin(InfraHardwareModuleMapperEntity,
            "ihmm",
            "ihmm.hardware_id = hs.id"
          )
          .leftJoin(InfraModuleEntity, "mod", "mod.id = ihmm.module_id")
          .leftJoin(
            PodDetailsEntity,
            "pd",
            `pd.id = (
                SELECT p3.id
                FROM infra_schema.pod_details p3
                WHERE p3.infra_allocation_id = ia.id
                AND p3.is_delete = 0
                ORDER BY (CASE WHEN p3.status = 'READY' THEN 1 ELSE 2 END), p3.id DESC
                LIMIT 1
            )`
          )
          .leftJoin(
            (subQuery) => {
              return subQuery
                .select("pd1.infra_allocation_id", "infra_allocation_id")
                .addSelect(
                  "(SELECT pd2.status FROM infra_schema.pod_details pd2 WHERE pd2.infra_allocation_id = pd1.infra_allocation_id AND pd2.is_delete = 0 ORDER BY CASE pd2.status WHEN 'READY' THEN 7 WHEN 'START' THEN 6 WHEN 'PENDING' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'PAUSED' THEN 3 WHEN 'DELETED' THEN 2 WHEN 'END' THEN 1 ELSE 0 END DESC, pd2.id DESC LIMIT 1)",
                  "status"
                )
                .from(PodDetailsEntity, "pd1")
                .where("pd1.is_delete = 0")
                .groupBy("pd1.infra_allocation_id");
            },
            "agg_pd",
            "agg_pd.infra_allocation_id = ia.id"
          )
          .where("ia.id = :id", { id: param.id })
          .getRawOne();

        if (!result) {
          return reject("E10062");
        }

        if (result) {
          (result.hashId = CryptoJS.MD5(result.id.toString()).toString());
          const config = result.config;
          if (
            config &&
            config.node_groups &&
            Array.isArray(config.node_groups) &&
            config.node_groups.length > 0
          ) {
            try {
              const nodeGroups = await NodeGroupsEntity.findBy({
                id: In(config.node_groups),
              });
              result.node_group_names = nodeGroups.map((ng) => ng.name);
            } catch (err) {
              console.error("Error fetching node group names:", err);
              result.node_group_names = [];
            }
          } else {
            result.node_group_names = [];
          }
          result.processing_type = "SYNC";
          DeploymentService.processDeploymentStatus(result);

          if (result.model_id) {
            try {
              let targetModelId = result.model_id;

              const moduleType = await InfraModuleEntity.findOneBy({ id: result.module_type_id });

              if (moduleType && moduleType.name === DeploymentType.NIM) {
                // NIM deployments: fetch api_details from model_api_details with module_type='nim'
                const nimModel = await NimModelEntity.findOneBy({ id: result.model_id, is_delete: 0 });
                if (nimModel) {
                  const nimModelIdentifier = nimModel.model_identifier || nimModel.name; // e.g. "meta/llama-3.1-8b-instruct"

                  // Resolve provider icon from nim_model's model_provider_id
                  if (nimModel.model_provider_id) {
                    const provider = await ModelProviderEntity.findOneBy({
                      id: nimModel.model_provider_id,
                      is_delete: 0,
                    });
                    if (provider) {
                      result.model_provider_icon = provider.model_provider_icon;
                      result.model_provider_id = provider.id;
                    }
                  }

                  // Fetch api_details from model_api_details table (module_type='nim')
                  const nimApiDetails = await ModelAPIDetailsEntity.createQueryBuilder("mad")
                    .where("mad.model_id = :modelId", { modelId: nimModel.id })
                    .andWhere("mad.is_delete = 0")
                    .andWhere("mad.module_type = :moduleType", { moduleType: 'nim' })
                    .getMany();

                  result.api_details = nimApiDetails;
                  result.nim_model_identifier = nimModelIdentifier;
                } else {
                  result.api_details = [];
                }
              } else if (moduleType && moduleType.name === DeploymentType.TRAINING) {
                const trainingModel = await ModelTrainingEntity.findOneBy({ id: result.model_id });
                if (trainingModel && trainingModel.model_id) {
                  const baseModel = await ModelEntity.findOneBy({ id: trainingModel.model_id });
                  if (baseModel) {
                    targetModelId = baseModel.id;

                    const provider = await ModelProviderEntity.findOneBy({
                      id: baseModel.model_provider_id,
                      is_delete: 0,
                    });
                    if (provider) {
                      result.model_provider_icon = provider.model_provider_icon;
                      result.model_provider_id = provider.id;
                    }

                    result.playground_config = baseModel.playground_config;
                  }
                }
              } else if (result.module_type_id === 3) {
                // If it is My Model (ID 3), find the base model with non-null company/member
                const modelDetail = await ModelEntity.findOneBy({ id: result.model_id });
                if (modelDetail && modelDetail.model_class_id) {
                  const baseModel = await ModelEntity.findOne({
                    where: {
                      model_class_id: modelDetail.model_class_id,
                      company_id: IsNull(),
                      member_id: IsNull(),
                      is_delete: 0
                    }
                  });

                  if (baseModel) {
                    targetModelId = baseModel.id;

                    const provider = await ModelProviderEntity.findOneBy({
                      id: baseModel.model_provider_id,
                      is_delete: 0,
                    });
                    if (provider) {
                      result.model_provider_icon = provider.model_provider_icon;
                      result.model_provider_id = provider.id;
                    }

                    result.playground_config = baseModel.playground_config;
                  }
                }
              }

              // For non-NIM types, fetch api_details from the model_api_details table
              if (!moduleType || moduleType.name !== DeploymentType.NIM) {
                const apiDetails = await ModelAPIDetailsEntity.createQueryBuilder("mad")
                  .where("mad.model_id = :modelId", { modelId: targetModelId })
                  .andWhere("mad.is_delete = 0")
                  .andWhere("(mad.module_type = :moduleType OR mad.module_type IS NULL)", { moduleType: 'model' })
                  .getMany();
                result.api_details = apiDetails;
              }
            } catch (err) {
              console.error("Error fetching API details:", err);
              result.api_details = [];
            }
          } else {
            result.api_details = [];
          }

          try {
            const tokenEntity = await ApiKeyTokenEntity.findOneBy({
              generatedby_user_id: param.decryptToken?.member_id,
              company_id: result.company_id,
              is_delete: 0,
              status: 1,
              is_playground_key: true
            });
            result.deployment_token = tokenEntity ? tokenEntity.generated_token : null;
          } catch (err) {
            console.error("Error fetching deployment token:", err);
            result.deployment_token = null;
          }

          result.health_check = (
            result.status === DeploymentStatus.READY
          ) ? true : false;

          if (result.model_provider_icon) {
            try {
              result.model_icon = await this.generateSignedUrl(
                "modelProviderMedia",
                result.model_provider_id,
                result.model_provider_icon
              );
            } catch (err) {
              console.error("Error generating signed URL for model provider icon:", err);
              result.model_icon = null;
            }
          } else {
            result.model_icon = null;
          }
          const kbs = await KnowledgeBaseEntity.createQueryBuilder("kb")
            .innerJoin(DeploymentKbIntegrationEntity, "dkbi", "dkbi.knowledge_base_id = kb.id")
            .where("dkbi.deployment_id = :deploymentId AND dkbi.is_active = true AND dkbi.is_delete = 0 AND kb.is_delete = 0", { deploymentId: result.id })
            .select(["kb.id as id", "kb.name as name"])
            .getRawMany();
          result.knowledge_base_integrated = kbs;
        }

        resolve(result);
      } catch (error) {
        console.log("---Clusters.prepareQueryById--------", error);
        reject(error);
      }
    });
  }

  public static processDeploymentStatus(item: any): any {
    if (item.status === 'RESUMED' || item.status === 'RESUME') {
      item.status = DeploymentStatus.START;
    }
    if (item.status === DeploymentStatus.END) {
      if (item.is_delete === 1) {
        item.status = DeploymentStatus.DELETED;
      } else {
        item.status = DeploymentStatus.PAUSED;
      }
    }

    item.deployment_accepted = false;
    item.connect_to_cluster = false;
    item.model_deployment = false;
    item.scale_down = false;
    item.health_check = (item.status === DeploymentStatus.READY) ? true : false;

    if (item.status === DeploymentStatus.PENDING) {
      item.deployment_accepted = true;
    } else if (item.status === DeploymentStatus.START) {
      item.deployment_accepted = true;
      item.connect_to_cluster = true;
    } else if (item.status === DeploymentStatus.READY) {
      item.deployment_accepted = true;
      item.connect_to_cluster = true;
      item.model_deployment = true;
    } else if (item.status === DeploymentStatus.END || item.status === DeploymentStatus.PAUSED) {
      item.scale_down = true;
    } else if (item.status === DeploymentStatus.FAILED) {
      item.scale_down = false;
    } else if (item.status === DeploymentStatus.DELETED) {
      item.scale_down = true;
    }

    return item;
  }

  async updateStatus(model: any): Promise<any> {
    try {
      const result = await this.entity.findOneBy({ id: model.id });
      if (!result) {
        throw "E10062";
      }

      let modelId = result.module_id;
      let modelName = "Unknown Model";
      let modelClassId = null;
      let quantizationId = null;
      let isPlayground = false;
      let deploymentType = DeploymentType.MYMODEL;

      const moduleType = await InfraModuleEntity.findOneBy({ id: result.module_type_id });

      if (moduleType && moduleType.name === DeploymentType.TRAINING) {
        deploymentType = DeploymentType.TRAINING;
        const trainingModel = await ModelTrainingEntity.findOneBy({ id: result.module_id });
        if (trainingModel) {
          modelName = trainingModel.name;
          const baseModel = await ModelEntity.findOneBy({ id: trainingModel.model_id });
          if (baseModel) {
            modelClassId = baseModel.model_class_id;
            quantizationId = baseModel.quantization_id;
          }
        }
      } else if (moduleType && moduleType.name === DeploymentType.NIM) {
        deploymentType = DeploymentType.NIM;
        const nimModel = await NimModelEntity.findOneBy({ id: result.module_id, is_delete: 0 });
        if (nimModel) {
          modelName = nimModel.name;
        }
      } else {
        const modelDetail = await ModelEntity.findOneBy({ id: result.module_id });
        if (modelDetail) {
          modelName = modelDetail.name;
          modelClassId = modelDetail.model_class_id;
          quantizationId = modelDetail.quantization_id;
          isPlayground = !modelDetail.company_id && !modelDetail.member_id;
          if (modelDetail.is_docker) {
            deploymentType = DeploymentType.DOCKER;
          } else {
            deploymentType = isPlayground ? DeploymentType.PLAYGROUND : DeploymentType.MYMODEL;
          }
        }
      }

      const request: any = {
        id: result.id,
        org_id: result.company_id,
        model_id: modelId,
        model_name: modelName,
        model_class: modelClassId
          ? (await ModelClassEntity.findOneBy({ id: modelClassId }))?.name
          : null,
        deployment_name: result.deployment_name,
        slug: result.slug,
        scaling_parameters: result.scaling_parameters,
        gpu_count_per_pod: result.config ? (result.config as any).gpu_count_per_pod : null,
        node_groups: result.config ? (result.config as any).node_groups : [],
        node_group_names:
          result.config &&
            (result.config as any).node_groups &&
            (result.config as any).node_groups.length > 0
            ? (
              await NodeGroupsEntity.findBy({
                id: In((result.config as any).node_groups),
              })
            ).map((ng) => ng.name)
            : [],
        deployment_type: deploymentType,
        process: (model.status || model.deployment_status)?.toUpperCase(),
        cluster_id: result.cluster_id,
        quantization: null,
        inference_engine: result.inference_engine,
      };

      if (quantizationId) {
        const quantization = await QuantizationEntity.findOneBy({ id: quantizationId });
        if (quantization) request.quantization = quantization.name;
      }

      // Enrich with Docker-specific fields for Docker deployments
      if (deploymentType === DeploymentType.DOCKER) {
        const modelDetail = await ModelEntity.findOneBy({ id: result.module_id });
        if (modelDetail) {
          request.is_docker = true;
          request.name = modelDetail.name;
          request.cpu_request = modelDetail.cpu_request;
          request.cpu_limit = modelDetail.cpu_limit;
          request.memory_request = modelDetail.memory_request;
          request.memory_limit = modelDetail.memory_limit;
          request.overall_configuration = modelDetail.overall_configuration || {};
          request.scaling_parameters = result.scaling_parameters || null;
          request.environment = process.env.NODE_ENV || 'dev';
          request.node_groups = request.node_group_names;

          delete request.model_id;
          delete request.model_name;
          delete request.model_class;
          delete request.quantization;
        }
      }

      // Enrich with NIM-specific fields for NVIDIA NIM deployments
      if (deploymentType === DeploymentType.NIM) {
        const nimModel = await NimModelEntity.findOneBy({ id: result.module_id, is_delete: 0 });
        if (nimModel) {
          request.is_nim = true;
          request.name = nimModel.name;
          request.image = nimModel.image;
          request.publisher = nimModel.publisher;
          request.category = nimModel.category;
          request.nim_model_id = nimModel.id;
          request.scaling_parameters = result.scaling_parameters || null;
          request.environment = process.env.NODE_ENV || 'dev';
          request.node_groups = request.node_group_names;

          delete request.model_class;
          delete request.quantization;
        }
      }

      const kafkaService = KafkaService.getInstance();
      await kafkaService.sendMessage(KAFKAPRODUCERS.DEPLOYMENT, request);

      if (request.process === DEPLOYMENTPROCESS.DELETE || request.process === DeploymentStatus.DELETED) {
        await this.entity.update({ id: result.id }, { is_delete: 1 });
        const quotaService = new DeploymentQuotaService();
        await quotaService.deleteQuotaByModelId(result.id);
        await this.deIntegrateKbForDeployment(result.id);

        try {
          const cloudFilter = new CloudFilter();
          cloudFilter.id = result.id;
          const updatedResult = await this.prepareQueryById(cloudFilter);
          if (updatedResult) {
            await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
              module: ModuleType.DEPLOYMENT,
              entity: updatedResult,
            });
          }
        } catch (wsError) {
          console.error("Error pushing WebSocket message on deletion:", wsError);
        }

        await AuditLogService.log({
          company_id: result.company_id,
          member_id: model.decryptToken?.member_id || result.user_id,
          module: this.getModuleName(),
          action: 'DELETE',
          entity_type: 'DeploymentEntity',
          entity_id: result.id,
          entity_name: result.deployment_name,
          description: `Deleted deployment`,
          ip_address: model.ip_address || '',
        });
      } else if (request.process === 'PAUSE' || request.process === DeploymentStatus.PAUSED) {
        await AuditLogService.log({
          company_id: result.company_id,
          member_id: model.decryptToken?.member_id || result.user_id,
          module: this.getModuleName(),
          action: 'PAUSE',
          entity_type: 'DeploymentEntity',
          entity_id: result.id,
          entity_name: result.deployment_name,
          description: `Paused deployment`,
          ip_address: model.ip_address || '',
        });
      } else if (request.process === 'RESUME' || request.process === 'START') {
        await AuditLogService.log({
          company_id: result.company_id,
          member_id: model.decryptToken?.member_id || result.user_id,
          module: this.getModuleName(),
          action: 'RESUME',
          entity_type: 'DeploymentEntity',
          entity_id: result.id,
          entity_name: result.deployment_name,
          description: `Resumed deployment`,
          ip_address: model.ip_address || '',
        });
      }
      return request;
    } catch (error) {
      throw error;
    }
  }

  async updateStatusFromKafka(model: any): Promise<any> {
    try {
      const deploymentId = model.id || model.deployment_id;
      if (!deploymentId) {
        console.error("Deployment ID missing in Kafka message");
        return;
      }
      const result = await this.entity.findOneBy({ id: deploymentId });
      if (!result) {
        console.error(`Deployment with id ${deploymentId} not found for Kafka update`);
        return;
      }
      const updateData: any = {};

      // Removed status update based on DEPLOYMENTSTATUS per requirements,
      // now handled via pod lifecycle. Only updating is_delete condition if DELETED.
      if (model.status && model.status.toUpperCase() === DeploymentStatus.DELETED) {
        updateData.is_delete = 1;
        updateData.status = DeploymentStatus.DELETED;
        const quotaService = new DeploymentQuotaService();
        await quotaService.deleteQuotaByModelId(deploymentId);
        await this.deIntegrateKbForDeployment(deploymentId);
      }

      const endpointFromKafka = model.inference_endpoint || model.endpoint || model.model_endpoint || model.inference_url;
      if (endpointFromKafka) {
        updateData.model_proxy = endpointFromKafka;
        updateData.model_endpoint = MODEL_ENDPOINT_URL;
      }

      const grpcEndpoint = model.model_grpc || model.grpc_endpoint || model.grpc_url;
      if (grpcEndpoint) {
        updateData.model_grpc = grpcEndpoint;
      }

      const proxyEndpoint = model.model_proxy || model.proxy_endpoint || model.proxy_url;
      if (proxyEndpoint) {
        updateData.model_proxy = proxyEndpoint;
      }

      const healthCheckEndpoint = model.health_check_endpoint || model.health_check;
      if (healthCheckEndpoint) {
        updateData.health_check_endpoint = healthCheckEndpoint;
      }

      if (Object.keys(updateData).length > 0) {
        await this.entity.update({ id: deploymentId }, updateData);
      }
      const updatedEntity = await this.entity.findOneBy({ id: deploymentId });

      try {
        const cloudFilter = new CloudFilter();
        cloudFilter.id = deploymentId;
        const result = await this.prepareQueryById(cloudFilter);
        if (result) {
          await WebSocketService.pushMessageToCompany(result.company_id.toString(), {
            module: ModuleType.DEPLOYMENT,
            entity: result,
          });
        }
      } catch (wsError) {
        console.error("Error pushing WebSocket message in updateStatusFromKafka:", wsError);
      }

      return updatedEntity;
    } catch (error) {
      console.error("Error in updateStatusFromKafka:", error);
      throw error;
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

        const quotaService = new DeploymentQuotaService();
        for (const record of records) {
          await quotaService.deleteQuotaByModelId(record.id);
          await this.deIntegrateKbForDeployment(record.id);

          await AuditLogService.log({
            company_id: record.company_id,
            member_id: param.decryptToken?.member_id || record.user_id,
            module: this.getModuleName(),
            action: 'DELETE',
            entity_type: 'DeploymentEntity',
            entity_id: record.id,
            entity_name: record.deployment_name,
            description: `Deployment ${record.deployment_name} was deleted`,
            ip_address: param.ip_address || '',
          });
        }
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error in updateDeleteFlagData:", error);
      throw error;
    }
  };

  /**
   * De-integrate a deleted deployment from all knowledge bases.
   * Soft-deletes and deactivates all deployment_kb_integration records
   * for the given deployment.
   */
  private async deIntegrateKbForDeployment(deploymentId: number): Promise<void> {
    try {
      await DeploymentKbIntegrationEntity.update(
        { deployment_id: deploymentId, is_delete: 0 as any },
        { is_active: false, is_delete: 1 as any }
      );
    } catch (error) {
      console.error(`[DeploymentService] Failed to de-integrate KBs for deployment ${deploymentId}:`, error);
    }
  }
}

export default DeploymentService;
