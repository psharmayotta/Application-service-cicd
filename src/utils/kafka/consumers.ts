import { Message } from "node-rdkafka";
import { BatchJobStatus, BenchmarkingStatus, DatasetStatus, KAFKACONSUMER, ModelTrainingStatus, ModuleType, WebhookEvents } from "../../config";
import { DataSetModel } from "../../database/repository/dataSet/dataset.model";
import { DeploymentModel } from "../../database/repository/deployment/deployment.model";
import { ModelTrainingModel } from "../../database/repository/modelTraining/modelTraining.model";
import { MyModelModel } from "../../database/repository/MyModel/mymodel.model";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { TrainingWeightsModel } from "../../database/repository/trainingWeights/trainingWeights.model";
import { BatchInferenceEntity } from "../../entities/batchInferenceEntity";
import { BatchInferenceJobEntity } from "../../entities/batchInferenceJobEntity";
import { CompanyEntity } from "../../entities/companyEntity";
import { BenchmarkingEntity } from "../../entities/benchmarkingEntity";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { BatchInferenceService } from "../../services/batchInference/batchInference.service";
import BenchmarkingService from "../../services/benchmarking/benchmarkingService.services";
import BudgetControlService from "../../services/budgetControl/budgetControlService.services";
import DataSetService from "../../services/dataSet/dataSetService.services";
import DeploymentService from "../../services/deployments/deploymentService.services";
import InfraQueueService from "../../services/infraQueue/infraQueueService.services";
import KnowledgeBaseService from "../../services/knowledgeBase/knowledgeBaseService.services";
import ModelTrainingService from "../../services/modelTraining/modelTrainingService.services";
import TrainingWeightsService from "../../services/modelTraining/trainingWeightsService.services";
import MyModelService from "../../services/myModel/myModelService.service";
import { NotificationService } from "../../services/notification/notificationService.services";
import PodDetailsService from "../../services/podDetails/podDetailsService.service";
import { WebhookService } from "../../services/webhook/webhookService.services";
import { WebSocketService } from "../webSocket/webSocketService";
import AuditLogService from "../../services/auditLog/auditLogService.services";

const quotaAlertCache = new Map<string, number>();

export const kafkaConsumers = [
  {
    topic: KAFKACONSUMER.PODLIFECYCLE,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();

      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed.labels?.['my_model.deployment_id']) {
            const podDetailsService = new PodDetailsService();
            await podDetailsService.processKafkaMessage(parsed);
          }
          console.log("Parsed message:", parsed);
        } catch (err) {
          console.error("Failed to parse Kafka message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.COMPILESTATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const myModelService = new MyModelService();
          const myModelModel = new MyModelModel();
          myModelModel.id = parsed.id;
          myModelModel.status = parsed.status;
          myModelModel.latest_kafka_message = parsed;
          await myModelService.updateStatus(myModelModel);
          console.log("Parsed COMPILESTATUS message:", parsed);
        } catch (err) {
          console.error("Failed to parse COMPILESTATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.FETCHUPDATEDCREDIT,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);

          await WebSocketService.pushMessageToCompany(
            parsed.company_id.toString(),
            {
              module: ModuleType.CREDIT,
              entity: parsed.entity
            }
          );
          console.log("Parsed CALCULATECREDIT message:", parsed);

          if (parsed.company_id) {
            BudgetControlService.checkAndTriggerAlert(parseInt(parsed.company_id, 10)).catch(err => {
              console.error("Error running checkAndTriggerAlert in FETCHUPDATEDCREDIT consumer:", err);
            });
          }
        } catch (err) {
          console.error("Failed to parse CALCULATECREDIT message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.PLAYGROUNDTOKENIZER,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const entity = {
            chat_session_id: parsed.chat_session_id,
            session_id: parsed.session_id,
            company_id: parsed.company_id,
            model_id: parsed.model_id,
            input_tokens: parsed.input_tokens,
            output_tokens: parsed.output_tokens,
            inference_time: parsed.inference_time,
          }
          await WebSocketService.pushMessageToCompany(parsed.company_id.toString(), {
            module: ModuleType.PLAYGROUND,
            entity: entity
          });
          console.log("Parsed PLAYGROUNDTOKENIZER message:", parsed);
        } catch (err) {
          console.error("Failed to parse PLAYGROUNDTOKENIZER message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.MYMODEL,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const myModelModel = new MyModelModel();
          const myModelService = new MyModelService();
          const parsed = JSON.parse(rawValue);
          myModelModel.id = parsed.id;
          myModelModel.status = parsed.status;
          myModelModel.latest_kafka_message = parsed;
          await myModelService.updateStatus(myModelModel);
          console.log("Parsed MYMODEL message:", parsed);
        } catch (err) {
          console.error("Failed to parse MYMODEL message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.DATASETSTATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const dataSetService = new DataSetService();
          const dataSetModel = new DataSetModel();
          dataSetModel.id = parsed.dataset_id;
          dataSetModel.download_status = parsed.status === 'Success';
          dataSetModel.yotta_bucket_path = parsed.download_dataset_path;
          dataSetModel.size = parsed.size;
          dataSetModel.failure_message = parsed.message;
          dataSetModel.status = parsed.status === 'Success' ? DatasetStatus.SUCCESS : DatasetStatus.FAILED;
          await dataSetService.updateStatus(dataSetModel);
          console.log("Parsed DATASETSTATUS message:", parsed);

          // Handle associated model trainings
          const modelTrainingService = new ModelTrainingService();
          const pendingTrainings = await ModelTrainingEntity.find({
            where: {
              dataset_id: parsed.dataset_id,
              status: ModelTrainingStatus.PENDING,
              is_delete: 0
            }
          });

          for (const training of pendingTrainings) {
            if (parsed.status === 'Success') {
              console.log(`Dataset Success: Initiating training ${training.id}`);
              await modelTrainingService.initiateTraining(training);
            } else {
              console.log(`Dataset Failed: Failing training ${training.id}`);
              const trainingModel = new ModelTrainingModel();
              trainingModel.id = training.id;
              trainingModel.status = ModelTrainingStatus.FAILED;
              trainingModel.latest_kafka_message = {
                message: parsed.message || 'Dataset download failed',
                dataset_id: parsed.dataset_id,
                source: KAFKACONSUMER.DATASETSTATUS,
              };
              await modelTrainingService.updateStatus(trainingModel);
            }
          }

          // Handle associated queued benchmarkings
          const benchmarkingService = new BenchmarkingService();
          const queuedBenchmarkings = await BenchmarkingEntity.find({
            where: {
              status: 'Queued',
              is_delete: 0
            }
          });

          for (const benchmark of queuedBenchmarkings) {
            const datasetIds = Array.isArray(benchmark.dataset_id) ? benchmark.dataset_id : [];
            const isTargetDataset = datasetIds.some((d: any) => d.id === parsed.dataset_id && d.type === 'custom_dataset');

            if (isTargetDataset) {
              if (parsed.status === 'Success') {
                console.log(`Dataset Success: Initiating benchmarking ${benchmark.id}`);
                await benchmarkingService.entity.update({ id: benchmark.id }, { status: BenchmarkingStatus.PENDING });
                benchmark.status = BenchmarkingStatus.PENDING;
                await benchmarkingService.initiateBenchmarking(benchmark);
              } else {
                console.log(`Dataset Failed: Failing benchmarking ${benchmark.id}`);
                await benchmarkingService.entity.update({ id: benchmark.id }, { status: BenchmarkingStatus.FAILED });
                await AuditLogService.logFailureIncident({
                  company_id: benchmark.company_id,
                  member_id: benchmark.member_id,
                  module: benchmarkingService.getModuleName(),
                  entity_type: 'BenchmarkingEntity',
                  entity_id: benchmark.id,
                  entity_name: benchmark.name,
                  description: `Benchmarking ${benchmark.name} failed`,
                  reason: parsed.message || 'Dataset download failed',
                  metadata: {
                    dataset_id: parsed.dataset_id,
                    failure_source: 'dataset',
                  },
                });
              }
            }
          }

          // Handle associated queued batch inferences (only checking the latest job for each inference config)
          const batchInferenceService = new BatchInferenceService();
          const batchInferences = await BatchInferenceEntity.find({
            where: {
              dataset_id: parsed.dataset_id,
              is_delete: 0
            }
          });

          for (const inference of batchInferences) {
            const latestJob = await BatchInferenceJobEntity.findOne({
              where: {
                inference_id: inference.id,
                is_delete: 0
              },
              order: {
                created_at: "DESC"
              }
            });

            if (latestJob && latestJob.status === BatchJobStatus.QUEUED) {
              if (parsed.status === 'Success') {
                console.log(`Dataset Success: Initiating batch inference job ${latestJob.id}`);
                await batchInferenceService.initiateJob(latestJob, inference);
              } else {
                console.log(`Dataset Failed: Failing batch inference job ${latestJob.id}`);
                latestJob.status = BatchJobStatus.FAILED;
                await BatchInferenceJobEntity.save(latestJob);

                await AuditLogService.logFailureIncident({
                  company_id: inference.company_id,
                  member_id: inference.member_id,
                  module: batchInferenceService.getModuleName(),
                  entity_type: 'BatchInferenceEntity',
                  entity_id: inference.id,
                  entity_name: inference.name,
                  description: `Batch inference ${inference.name} failed`,
                  reason: parsed.message || 'Dataset download failed',
                  metadata: {
                    job_id: latestJob.id,
                    dataset_id: parsed.dataset_id,
                    failure_source: 'dataset',
                  },
                });

                const notificationService = new NotificationService();
                const notification = new NotificationModel();
                notification.module_name = ModuleType.BATCH_INFERENCE;
                notification.notification_type = 'Updated';
                notification.is_readed = false;
                notification.company_id = inference.company_id;
                notification.user_id = inference.member_id;
                notification.message = `Batch inference "${inference.name}" failed because dataset download failed.`;
                await notificationService.createRecord(notification, null);
              }
            }
          }
        } catch (err) {
          console.error("Failed to parse DATASETSTATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.NOTIFICATIONINIT,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const notificationModel = new NotificationModel();
          notificationModel.module_name = parsed.module;
          notificationModel.notification_type = 'Created';
          notificationModel.is_readed = false;
          notificationModel.company_id = parsed.company_id;
          notificationModel.user_id = parsed.member_id;
          notificationModel.message = `₹${parsed.request.amount} credits added to your account`;
          const notificationService = new NotificationService();
          await notificationService.createRecord(notificationModel, null);

          await AuditLogService.log({
            company_id: parsed.company_id,
            member_id: parsed.member_id,
            module: 'Wallet',
            action: 'Add Credit',
            entity_type: 'Wallet',
            entity_id: parsed.entity_id,
            description: `₹${parsed.request.amount} credits added to your account`
          });

          console.log("Parsed NOTIFICATION message and saved record:", parsed);
        } catch (err) {
          console.error("Failed to parse NOTIFICATION message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.TRAINING,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const modelTrainingService = new ModelTrainingService();
          const modelTrainingModel = new ModelTrainingModel();
          modelTrainingModel.id = parsed.id;
          modelTrainingModel.status = parsed.status;
          modelTrainingModel.latest_kafka_message = parsed;
          await modelTrainingService.updateStatus(modelTrainingModel);
          console.log("Parsed TRAINING message:", parsed);
        } catch (err) {
          console.error("Failed to parse TRAINING message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.NODESNAPSHOT,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          if (parsed.gpu && parsed.gpu.free > 0) {
            console.log(`Node ${parsed.node}: ${parsed.gpu.free} free GPU(s) detected (${parsed.labels?.accelerator || 'unknown type'})`);
            try {
              const queueService = new InfraQueueService();
              const acceleratorId = await queueService.resolveAcceleratorIdFromNode(parsed.node);
              if (acceleratorId) {
                console.log(`Processing queue for Accelerator ID: ${acceleratorId}`);
                const result = await queueService.processQueue(acceleratorId);
                if (result.processed > 0) {
                  console.log(`Queue processing result: ${result.processed} processed, ${result.failed} failed`);
                }
              } else {
                console.warn(`Could not resolve Accelerator ID for node ${parsed.node}. Skipping queue processing.`);
              }
            } catch (queueError) {
              console.error("Error processing queue after node snapshot:", queueError);
            }
          }
        } catch (err) {
          console.error("Failed to parse NODESNAPSHOT message:", err);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.DEPLOYMENTSTATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("Parsed DEPLOYMENTSTATUS message:", parsed);
          const deploymentService = new DeploymentService();
          const deploymentModel = new DeploymentModel();
          deploymentModel.id = parsed.deployment_id ? parseInt(parsed.deployment_id) : parsed.id;
          const payload = { ...parsed, id: deploymentModel.id };
          await deploymentService.updateStatusFromKafka(payload);
        } catch (err) {
          console.error("Failed to parse DEPLOYMENTSTATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.BENCHMARKINGINFO,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("Parsed BENCHMARKINGINFO message:", parsed);
          const benchmarkingService = new BenchmarkingService();
          await benchmarkingService.updateResult(parsed);
          console.log("Parsed BENCHMARKINGINFO message and updated results:", parsed.benchmark_id);
        } catch (err) {
          console.error("Failed to parse BENCHMARKINGINFO message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.RAGSTATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const kbId = parsed.knowledge_base_id || parsed.id;
          if (!kbId) {
            console.error("RAGSTATUS message missing ID:", parsed);
            return;
          }

          const knowledgeBaseService = new KnowledgeBaseService();
          await knowledgeBaseService.updateStatus(parsed);
          console.log("Parsed RAGSTATUS message and updated KB:", parsed);
        } catch (err) {
          console.error("Failed to parse RAGSTATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.BATCH_INFERENCE_STATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("Parsed BATCH_INFERENCE_STATUS message:", parsed);
          const batchInferenceService = new BatchInferenceService();
          await batchInferenceService.updateJobStatus(parsed);
          console.log("Parsed BATCH_INFERENCE_STATUS message:", parsed.job_id);
        } catch (err) {
          console.error("Failed to parse BATCH_INFERENCE_STATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.BATCH_INFERENCE_RESULT,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("Parsed BATCH_INFERENCE_RESULT message:", parsed);
          const batchInferenceService = new BatchInferenceService();
          await batchInferenceService.saveJobResult(parsed);
        } catch (err) {
          console.error("Failed to parse BATCH_INFERENCE_RESULT message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.BENCHMARKINGSTATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("Parsed BENCHMARKINGSTATUS message:", parsed);
          const benchmarkingService = new BenchmarkingService();
          await benchmarkingService.updateBenchmarkingStatus(parsed);
          console.log("Parsed BENCHMARKINGSTATUS message and updated status:", parsed.benchmark_id || parsed.id);
        } catch (err) {
          console.error("Failed to parse BENCHMARKINGSTATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.EVALUATION_STATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("[KAFKA_EVAL_LISTENER] Received EVALUATION_STATUS:", parsed);
          const benchmarkingService = new BenchmarkingService();
          await benchmarkingService.updateEvaluationStatus(parsed);
        } catch (err) {
          console.error("[KAFKA_EVAL_LISTENER] Failed to parse EVALUATION_STATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.EVALUATION_RESULT,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          console.log("[KAFKA_EVAL_LISTENER] Received EVALUATION_RESULT:", parsed);
          const benchmarkingService = new BenchmarkingService();
          await benchmarkingService.updateEvaluationStatus(parsed);
        } catch (err) {
          console.error("[KAFKA_EVAL_LISTENER] Failed to parse EVALUATION_RESULT message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.TRAINING_WEIGHTS_STATUS,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const trainingWeightsService = new TrainingWeightsService();
          const trainingWeightsModel = new TrainingWeightsModel();
          trainingWeightsModel.training_id = parsed.training_id;
          trainingWeightsModel.status = parsed.status;
          await trainingWeightsService.updateStatus(trainingWeightsModel);
          console.log("Parsed TRAINING_WEIGHTS_STATUS message:", parsed);
        } catch (err) {
          console.error("Failed to parse TRAINING_WEIGHTS_STATUS message:", err, rawValue);
        }
      }
    },
  },
  {
    topic: KAFKACONSUMER.QUOTA_REACHED,
    handler: async (msg: Message) => {
      const rawValue = msg.value?.toString();
      if (rawValue) {
        try {
          const parsed = JSON.parse(rawValue);
          const { company_id, model_id, quota_type, limit, used } = parsed;

          const cacheKey = `${company_id}_${model_id}_${quota_type}`;
          const lastSent = quotaAlertCache.get(cacheKey);
          if (lastSent && Date.now() - lastSent < 5 * 60 * 1000) {
            return;
          }
          quotaAlertCache.set(cacheKey, Date.now());

          const alertMessage = `Usage limit reached (${quota_type} limit: ${limit}, current usage: ${used}).`;
          const webhookService = new WebhookService();
          const quotaCompany = await CompanyEntity.findOneBy({ id: company_id, is_delete: 0 });
          await webhookService.dispatchTemplatedAlert(company_id, 'QUOTA_REACHED', 'REACHED', {
            quota_type,
            limit: String(limit),
            used: String(used),
            workspace: quotaCompany ? (quotaCompany as any).company_name : '',
          });
        } catch (err) {
          console.error("Error processing quota reached Kafka consumer message:", err);
        }
      }
    }
  }
];
