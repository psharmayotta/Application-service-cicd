import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { PodDetailsEntity } from "../../entities/podDetails";
import { PodDetailsModel } from "../../database/repository/podDetails/podDetail.model";
import { PodDetailsDto } from "../../database/repository/podDetails/podDetails.dto";
import * as CryptoJS from "crypto-js";
import { CloudFilter, Pagination } from "../../core/InferParams";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import PodLogService from "../podLog/podlogService.service";
import { PodLogModel } from "../../database/repository/podLog/podLog.model";
import DeploymentService from "../deployments/deploymentService.services";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { KAFKAPRODUCERS, ModuleType, DeploymentStatus, ModuleTypeQuota, NotificationType, WebhookEvents } from "../../config";
import { ModelEntity } from "../../entities/modelEntity";
import { DeploymentQuotaEntity } from "../../entities/deploymentQuotaEntity";
import { KafkaService } from "../../utils/kafka/KafkaService";
import GpuUsageService from "../gpuUsage/gpuUsageService.services";
import { MembersEntity } from "../../entities/membersEntity";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { IsNull } from "typeorm";
import { WebhookService } from "../webhook/webhookService.services";
import AuditLogService from "../auditLog/auditLogService.services";

class PodDetailsService extends BaseServices {
  constructor(
    entity: any = PodDetailsEntity,
    protected awsService: AwsService = new AwsService()
  ) {
    super(entity, awsService);
  }

  getModel(): PodDetailsModel {
    return new PodDetailsModel();
  }

  getDTO() {
    return PodDetailsDto;
  }

  async prepareQueryById(param: Pagination): Promise<any> {
    try {
      const record = await this.entity
        .createQueryBuilder("e")
        .select("*")
        .where("e.is_delete = 0")
        .andWhere("e.id = :id", { id: param.id })
        .getRawOne();

      if (record) {
        record.hashId = CryptoJS.MD5(record.id.toString()).toString();
      }

      return record;
    } catch (error) {
      console.log("-----HostedZoneService prepareQueryById-----", error);
      throw error;
    }
  }

  async processKafkaMessage(message: any) {
    const allocationId = message.labels?.["my_model.deployment_id"] || message.labels?.deployment_id || message.labels?.["my_model.id"];
    if (!allocationId) {
      console.warn(" No infra_allocation_id found in message.labels");
      return;
    }

    const allocation = await InfraAllocationEntity.findOne({
      where: { id: allocationId },
    });
    if (!allocation) {
      console.warn(`Allocation with id ${allocationId} not found. Skipping.`);
      return;
    }

    const existingPod = await this.entity.findOne({
      where: { pod_name: message.uid },
    });
    const pod = new PodDetailsModel();
    pod.id = existingPod?.id ?? null;
    pod.infra_allocation_id = allocationId;
    pod.pod_name = message.uid;
    pod.namespace = message.name;
    const msgTypeUpper = message.type?.toUpperCase();
    pod.status = msgTypeUpper;
    pod.host_ip = message.hostIP ?? "";
    pod.pod_ip = message.podIP ?? "";

    if (msgTypeUpper === DeploymentStatus.READY || msgTypeUpper === DeploymentStatus.START) {
      pod.start_time = existingPod?.start_time ?? (message.ts ? new Date(message.ts) : new Date());
      pod.end_time = null;
    } else if (msgTypeUpper === DeploymentStatus.END || msgTypeUpper === DeploymentStatus.DELETED || msgTypeUpper === DeploymentStatus.FAILED) {
      pod.start_time = existingPod?.start_time ?? null;
      pod.end_time = message.ts ? new Date(message.ts) : new Date();
    } else {
      pod.start_time = existingPod?.start_time ?? null;
      pod.end_time = existingPod?.end_time ?? null;
    }

    pod.labels = message.labels;
    pod.annotations = message.annotations;
    const savedPod = await this.entity.save(pod);

    if (message.labels?.["my_model.deployment_id"] || message.labels?.deployment_id) {
      // Query all active pods for this allocation to find the max status
      const activePods = await this.entity.find({
        where: {
          infra_allocation_id: allocationId,
          is_delete: 0,
        }
      });

      const STATUS_PRIORITY: Record<string, number> = {
        [DeploymentStatus.READY]: 7,
        [DeploymentStatus.START]: 6,
        [DeploymentStatus.PENDING]: 5,
        [DeploymentStatus.FAILED]: 4,
        [DeploymentStatus.PAUSED]: 3,
        [DeploymentStatus.DELETED]: 2,
        [DeploymentStatus.END]: 1,
      };

      let newStatus = msgTypeUpper;
      if (activePods.length > 0) {
        let maxPriority = -1;
        let maxStatus = null;
        for (const p of activePods) {
          const statusUpper = p.status?.toUpperCase();
          const priority = STATUS_PRIORITY[statusUpper] ?? 0;
          if (priority > maxPriority) {
            maxPriority = priority;
            maxStatus = statusUpper;
          }
        }
        if (maxStatus) {
          newStatus = maxStatus;
        }
      }

      if (allocation.is_delete === 1) {
        newStatus = DeploymentStatus.DELETED;
      } else if (newStatus === DeploymentStatus.END) {
        newStatus = DeploymentStatus.PAUSED;
      }

      if (newStatus) {
        const previousAllocationStatus = (allocation.status as any)?.toString()?.toUpperCase();

        await InfraAllocationEntity.update({ id: allocation.id }, { status: newStatus as any });
        allocation.status = newStatus as any;

        // Send notification when deployment first transitions to READY
        if (newStatus === DeploymentStatus.READY && previousAllocationStatus !== DeploymentStatus.READY) {
          try {
            const notificationService = new NotificationService();
            const notificationModel = new NotificationModel();
            notificationModel.user_id = allocation.user_id;
            notificationModel.company_id = allocation.company_id;
            const member = await MembersEntity.findOneBy({ id: allocation.user_id });
            const userName = member ? member.full_name : 'User';
            notificationModel.message = `Deployment - ${allocation.deployment_name} is now Ready`;
            notificationModel.notification_type = NotificationType.SUCCESS;
            notificationModel.module_name = ModuleType.DEPLOYMENT;
            notificationModel.is_readed = false;
            await notificationService.createRecord(notificationModel, null);
            console.log(`[PodDetails] Sent READY notification for deployment ${allocationId} (${allocation.deployment_name})`);
          } catch (notifError) {
            console.error(`[PodDetails] Failed to send READY notification for deployment ${allocationId}:`, notifError);
          }

          await AuditLogService.log({
            company_id: allocation.company_id,
            member_id: allocation.user_id,
            module: 'Deployment',
            action: 'COMPLETED',
            entity_type: 'DeploymentEntity',
            entity_id: allocation.id,
            entity_name: allocation.deployment_name,
            description: `Deployment ${allocation.deployment_name} completed`,
            metadata: {
              pod_name: message.uid,
              previous_status: previousAllocationStatus,
              current_status: newStatus,
            },
            ip_address: '',
          });
        }

        // Send notification when deployment transitions to FAILED
        if (newStatus === DeploymentStatus.FAILED && previousAllocationStatus !== DeploymentStatus.FAILED) {
          try {
            const notificationService = new NotificationService();
            const notificationModel = new NotificationModel();
            notificationModel.user_id = allocation.user_id;
            notificationModel.company_id = allocation.company_id;
            notificationModel.message = `Deployment - ${allocation.deployment_name} has Failed`;
            notificationModel.notification_type = NotificationType.FAILED;
            notificationModel.module_name = ModuleType.DEPLOYMENT;
            notificationModel.is_readed = false;
            await notificationService.createRecord(notificationModel, null);
            console.log(`[PodDetails] Sent FAILED notification for deployment ${allocationId} (${allocation.deployment_name})`);
          } catch (notifError) {
            console.error(`[PodDetails] Failed to send FAILED notification for deployment ${allocationId}:`, notifError);
          }

          await AuditLogService.logFailureIncident({
            company_id: allocation.company_id,
            member_id: allocation.user_id,
            module: 'Deployment',
            entity_type: 'DeploymentEntity',
            entity_id: allocation.id,
            entity_name: allocation.deployment_name,
            description: `Deployment ${allocation.deployment_name} failed`,
            reason: message,
            metadata: {
              pod_name: message.uid,
              kafka_message: message,
              previous_status: previousAllocationStatus,
              current_status: newStatus,
            },
          });
        }

        if (newStatus === DeploymentStatus.READY) {
          try {
            const moduleId = allocation.module_id;
            const companyId = allocation.company_id;

            if (moduleId && companyId) {
              const model = await ModelEntity.findOneBy({ id: moduleId });
              let baseModelId = moduleId;

              if (model && model.model_class_id) {
                const baseModel = await ModelEntity.findOne({
                  where: {
                    model_class_id: model.model_class_id,
                    company_id: IsNull(),
                    member_id: IsNull(),
                    is_delete: 0
                  }
                });
                if (baseModel) {
                  baseModelId = baseModel.id;
                }
              }

              const defaultQuota = await DeploymentQuotaEntity.findOneBy({
                model_id: baseModelId,
                is_default: 1,
                is_delete: 0
              });

              if (defaultQuota) {
                const existingQuota = await DeploymentQuotaEntity.findOneBy({
                  model_id: allocationId,
                  company_id: companyId,
                  is_delete: 0,
                  module_type: ModuleTypeQuota.DEPLOYMENT
                });

                if (!existingQuota) {
                  const newQuota = new DeploymentQuotaEntity();
                  newQuota.model_id = allocationId;
                  newQuota.company_id = companyId;
                  newQuota.tpm_limit = defaultQuota.tpm_limit;
                  newQuota.rpm_limit = defaultQuota.rpm_limit;
                  newQuota.max_tpm_limit = defaultQuota.tpm_limit;
                  newQuota.max_rpm_limit = defaultQuota.rpm_limit;
                  newQuota.status = 'Approved';
                  newQuota.is_default = 0;
                  newQuota.module_type = ModuleTypeQuota.DEPLOYMENT;
                  await newQuota.save();
                  console.log(`Created default deployment quota for model ${moduleId} and company ${companyId}`);
                }
              }
            }
          } catch (e) {
            console.error("Failed to create deployment quota upon READY status:", e);
          }
        }
      }
    }

    const deploymentService = new DeploymentService();
    const cloudFilter = new CloudFilter();
    cloudFilter.id = allocationId;
    const result = await deploymentService.prepareQueryById(cloudFilter);

    await WebSocketService.pushMessageToCompany(allocation.company_id.toString(), {
      module: ModuleType.DEPLOYMENT,
      entity: result,
    });

    const podlogService = new PodLogService();
    const podlogModel = new PodLogModel();
    podlogModel.infra_allocation_id = allocationId;
    podlogModel.pod_name = message.uid;
    podlogModel.status = message.type?.toUpperCase() ?? null;
    podlogModel.message = message;
    podlogModel.timestamp = new Date();
    podlogService.createRecord(podlogModel, null);

    const deploymentObj = {
      infra_id: allocationId,
      pod_id: savedPod.id,
      company_id: result.company_id,
      memeber_id: result.user_id,
      node_id: result.node_id,
      hardware_specs_id: result.hardware_specs_id,
      module: 'DeploymentCost'
    }

    if (msgTypeUpper === DeploymentStatus.END || msgTypeUpper === DeploymentStatus.DELETED || msgTypeUpper === DeploymentStatus.FAILED) {
      const kafkaMessage = {
        module: 'DeploymentCost',
        request: deploymentObj,
        company_id: result.company_id,
        member_id: result.user_id
      };
      const kafkaService = KafkaService.getInstance();
      await kafkaService.sendMessage(KAFKAPRODUCERS.DEPLOYMENTCOST, kafkaMessage)
    }

    // --- GPU Usage Ledger Integration with State Transition Guard ---
    try {
      const gpuUsageService = new GpuUsageService();
      let gpuCount = Number(allocation.gpu_count_per_pod || 0);
      const eventTimestamp = message.ts ? new Date(message.ts) : new Date();

      // We only want to record state transitions to avoid double billing from Kafka retries.
      const previousStatus = existingPod?.status?.toUpperCase();

      if (msgTypeUpper === DeploymentStatus.READY && previousStatus !== DeploymentStatus.READY) {
        console.log(`[UsageLedger] Recording POD_START for allocation ${allocationId} (+${gpuCount} GPUs) at ${eventTimestamp.toISOString()}`);
        await gpuUsageService.trackEvent(Number(allocationId), 'POD_START', gpuCount, eventTimestamp);
      }
      else if (
        (msgTypeUpper === DeploymentStatus.END || msgTypeUpper === DeploymentStatus.DELETED || msgTypeUpper === DeploymentStatus.FAILED) &&
        (previousStatus !== DeploymentStatus.END && previousStatus !== DeploymentStatus.DELETED && previousStatus !== DeploymentStatus.FAILED)
      ) {
        console.log(`[UsageLedger] Recording POD_STOP for allocation ${allocationId} (-${gpuCount} GPUs) at ${eventTimestamp.toISOString()}`);
        await gpuUsageService.trackEvent(Number(allocationId), 'POD_STOP', -gpuCount, eventTimestamp);
      }
    } catch (gpuError) {
      console.error("[UsageLedger] Failed to track GPU event:", gpuError);
    }
  }
}

export default PodDetailsService;
