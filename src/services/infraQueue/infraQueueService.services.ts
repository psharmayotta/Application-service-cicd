import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { InfraQueueEntity } from "../../entities/infraQueueEntity";
import { InfraQueueModel } from "../../database/repository/infraQueue/infraQueue.model";
import { InfraQueueDto } from "../../database/repository/infraQueue/infraQueue.dto";
import { InfraQueueStatus, InfraQueueModuleType, KAFKAPRODUCERS, ModelTrainingStatus } from "../../config";
import { KafkaService } from "../../utils/kafka/KafkaService";
import InfraAvailabilityService from "../infraAvailability/infraAvailabilityService.services";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { LessThan, In } from "typeorm";
import AuditLogService from "../auditLog/auditLogService.services";

const MAX_RETRY_COUNT = 3;

class InfraQueueService extends BaseServices {
    constructor(
        entity: any = InfraQueueEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): InfraQueueModel {
        return new InfraQueueModel();
    }

    getDTO(): any {
        return InfraQueueDto;
    }

    getModuleName(): string {
        return 'Infra Queue';
    }

    private async markTrainingFailedFromQueue(queueItem: InfraQueueEntity, failureReason?: string): Promise<void> {
        if (queueItem.module_type !== InfraQueueModuleType.TRAINING) return;

        const training = await ModelTrainingEntity.findOneBy({ id: queueItem.module_id, is_delete: 0 });
        if (!training || training.status === ModelTrainingStatus.FAILED) return;

        const statusLog = Array.isArray(training.status_log) ? training.status_log : [];
        await ModelTrainingEntity.update(
            { id: training.id },
            {
                status: ModelTrainingStatus.FAILED,
                status_log: [
                    ...statusLog,
                    {
                        status: ModelTrainingStatus.FAILED,
                        timestamp: new Date().toISOString(),
                        source: 'infra_queue',
                    },
                ],
            }
        );

        const updatedTraining = await ModelTrainingEntity.findOneBy({ id: training.id });
        if (updatedTraining) {
            await WebSocketService.pushMessageToCompany(queueItem.company_id.toString(), {
                module: 'Training',
                entity: updatedTraining,
            });
        }

        await AuditLogService.logFailureIncident({
            company_id: queueItem.company_id,
            member_id: queueItem.member_id,
            module: 'Training',
            entity_type: 'ModelTrainingEntity',
            entity_id: training.id,
            entity_name: training.name,
            description: `Model Training ${training.name} failed`,
            reason: failureReason || queueItem.error_message || 'Infra queue processing failed',
            metadata: {
                queue_id: queueItem.id,
                retry_count: queueItem.retry_count,
                failure_source: 'infra_queue',
            },
        });
    }

    /**
     * Add an operation to the queue
     */
    async addToQueue(queueItem: InfraQueueModel): Promise<InfraQueueModel> {
        try {
            queueItem.status = InfraQueueStatus.PENDING;
            queueItem.retry_count = 0;

            const result = await this.entity.save(queueItem);
            console.log(`📋 Added to queue: module_type=${queueItem.module_type}, module_id=${queueItem.module_id}`);

            return result;
        } catch (error) {
            console.error('InfraQueueService addToQueue error:', error);
            throw error;
        }
    }

    /**
     * Get pending queue items sorted by priority (high to low) and creation time (old to new)
     * @param acceleratorId - optional filter by accelerator type
     */
    async getPendingItems(acceleratorId?: number): Promise<InfraQueueEntity[]> {
        try {
            const query = this.entity.createQueryBuilder('queue')
                .where('queue.status = :status', { status: InfraQueueStatus.PENDING })
                .andWhere('queue.is_delete = 0')
                .andWhere('queue.retry_count < :maxRetry', { maxRetry: MAX_RETRY_COUNT })
                .orderBy('queue.priority', 'DESC')
                .addOrderBy('queue.created_at', 'ASC');

            if (acceleratorId) {
                query.andWhere('queue.accelerator_id = :acceleratorId', { acceleratorId });
            }

            return await query.getMany();
        } catch (error) {
            console.error('InfraQueueService getPendingItems error:', error);
            throw error;
        }
    }

    /**
     * Update queue item status
     */
    async updateStatus(
        id: number,
        status: InfraQueueStatus,
        errorMessage?: string
    ): Promise<void> {
        try {
            const updateData: any = { status };

            if (errorMessage) {
                updateData.error_message = errorMessage;
            }

            if (status === InfraQueueStatus.FAILED) {
                // Increment retry count on failure
                await this.entity.createQueryBuilder()
                    .update(InfraQueueEntity)
                    .set({
                        status,
                        error_message: errorMessage,
                        retry_count: () => 'retry_count + 1'
                    })
                    .where('id = :id', { id })
                    .execute();

                const updatedQueueItem = await this.entity.findOneBy({ id });
                if (updatedQueueItem && updatedQueueItem.retry_count >= MAX_RETRY_COUNT) {
                    await this.markTrainingFailedFromQueue(updatedQueueItem, errorMessage);
                }
            } else {
                await this.entity.update({ id }, updateData);
            }

            console.log(`📋 Queue item ${id} status updated to ${status}`);
        } catch (error) {
            console.error('InfraQueueService updateStatus error:', error);
            throw error;
        }
    }

    /**
     * Process pending queue items when resources become available
     * @param acceleratorId - optional filter to process only items for specific accelerator
     */
    async processQueue(acceleratorId?: number): Promise<{ processed: number; failed: number }> {
        const availabilityService = new InfraAvailabilityService();
        let processed = 0;
        let failed = 0;

        try {
            const pendingItems = await this.getPendingItems(acceleratorId);
            console.log(`📋 Processing queue: ${pendingItems.length} pending items`);

            for (const item of pendingItems) {
                try {
                    // Check if resources are now available
                    const { available } = await availabilityService.checkAvailability(
                        item.accelerator_id,
                        item.accelerator_count
                    );

                    if (!available) {
                        console.log(`📋 Queue item ${item.id}: Resources still not available`);
                        continue;
                    }

                    // Mark as processing
                    await this.updateStatus(item.id, InfraQueueStatus.PROCESSING);

                    // Determine Kafka topic based on module type
                    const topic = this.getKafkaTopic(item.module_type);

                    // Send to Kafka
                    await KafkaService.getInstance().sendMessage(topic, item.payload);

                    // Update module status (e.g., training status from QUEUED to PENDING)
                    await this.updateModuleStatus(item.module_type, item.module_id, item.company_id);

                    // Mark as completed
                    await this.updateStatus(item.id, InfraQueueStatus.COMPLETED);

                    processed++;
                    console.log(`✅ Queue item ${item.id} processed successfully`);
                } catch (itemError) {
                    console.error(`❌ Error processing queue item ${item.id}:`, itemError);
                    await this.updateStatus(
                        item.id,
                        InfraQueueStatus.FAILED,
                        itemError instanceof Error ? itemError.message : 'Unknown error'
                    );
                    failed++;
                }
            }

            return { processed, failed };
        } catch (error) {
            console.error('InfraQueueService processQueue error:', error);
            throw error;
        }
    }

    /**
     * Get appropriate Kafka topic based on module type
     */
    private getKafkaTopic(moduleType: InfraQueueModuleType): string {
        switch (moduleType) {
            case InfraQueueModuleType.TRAINING:
                return KAFKAPRODUCERS.TRAININGINIT;
            case InfraQueueModuleType.MODEL:
                return KAFKAPRODUCERS.MYMODEL;
            default:
                return KAFKAPRODUCERS.TRAININGINIT;
        }
    }

    /**
     * Update the module status after queue processing
     */
    private async updateModuleStatus(
        moduleType: InfraQueueModuleType,
        moduleId: number,
        companyId: number
    ): Promise<void> {
        try {
            if (moduleType === InfraQueueModuleType.TRAINING) {
                await ModelTrainingEntity.update(
                    { id: moduleId },
                    { status: ModelTrainingStatus.PENDING }
                );

                // Send WebSocket notification
                const updatedTraining = await ModelTrainingEntity.findOneBy({ id: moduleId });
                if (updatedTraining) {
                    await WebSocketService.pushMessageToCompany(companyId.toString(), {
                        module: 'Training',
                        entity: updatedTraining
                    });
                }
            }
            // Add more module types as needed
        } catch (error) {
            console.error('InfraQueueService updateModuleStatus error:', error);
            // Don't throw - this is a non-critical operation
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    }> {
        try {
            const [pending, processing, completed, failed] = await Promise.all([
                this.entity.count({ where: { status: InfraQueueStatus.PENDING, is_delete: 0 } }),
                this.entity.count({ where: { status: InfraQueueStatus.PROCESSING, is_delete: 0 } }),
                this.entity.count({ where: { status: InfraQueueStatus.COMPLETED, is_delete: 0 } }),
                this.entity.count({ where: { status: InfraQueueStatus.FAILED, is_delete: 0 } })
            ]);

            return { pending, processing, completed, failed };
        } catch (error) {
            console.error('InfraQueueService getQueueStats error:', error);
            throw error;
        }
    }

    /**
     * Get queue items for a specific company
     */
    async getQueueByCompany(companyId: number, status?: InfraQueueStatus): Promise<InfraQueueEntity[]> {
        try {
            const where: any = {
                company_id: companyId,
                is_delete: 0
            };

            if (status) {
                where.status = status;
            }

            return this.entity.find({
                where,
                order: { created_at: 'DESC' }
            });
        } catch (error) {
            console.error('InfraQueueService getQueueByCompany error:', error);
            throw error;
        }
    }

    /**
     * Cancel a queued item
     */
    async cancelQueueItem(id: number, memberId: number): Promise<boolean> {
        try {
            const item = await this.entity.findOne({
                where: { id, is_delete: 0 }
            });

            if (!item) {
                throw new Error('Queue item not found');
            }

            if (item.status !== InfraQueueStatus.PENDING) {
                throw new Error('Only pending items can be cancelled');
            }

            await this.entity.update({ id }, { is_delete: 1 });

            // Also update the module status to reflect cancellation
            if (item.module_type === InfraQueueModuleType.TRAINING) {
                await ModelTrainingEntity.update(
                    { id: item.module_id },
                    { status: ModelTrainingStatus.FAILED }
                );
                await this.markTrainingFailedFromQueue(item, 'Training queue item was cancelled');
            }

            return true;
        } catch (error) {
            console.error('InfraQueueService cancelQueueItem error:', error);
            throw error;
        }
    }
    /**
     * Resolve accelerator ID (hardware_master_id) from hostname
     */
    async resolveAcceleratorIdFromNode(hostname: string): Promise<number | null> {
        try {
            // Import entities dynamically to avoid circular dependencies if any
            const { InfraNodesEntity } = await import("../../entities/infraNodesEntity");
            const { InfraSpecsMapperEntity } = await import("../../entities/infraSpecsMapperEntity");
            const { HardwareSpecsEntity } = await import("../../entities/hardwareSpecsEntity");

            const node = await InfraNodesEntity.findOne({
                where: { hostname, is_delete: 0 }
            });

            if (!node) {
                console.warn(`Node ${hostname} not found`);
                return null;
            }

            const mapper = await InfraSpecsMapperEntity.findOne({
                where: { node_id: node.id, is_delete: 0 }
            });

            if (!mapper) {
                console.warn(`No specs mapper found for node ${hostname}`);
                return null;
            }

            const spec = await HardwareSpecsEntity.findOne({
                where: { id: mapper.hardware_specs_id, is_delete: 0 }
            });

            if (!spec) {
                console.warn(`No hardware spec found for id ${mapper.hardware_specs_id}`);
                return null;
            }

            return spec.hardware_master_id;
        } catch (error) {
            console.error('InfraQueueService resolveAcceleratorIdFromNode error:', error);
            return null;
        }
    }
}

export default InfraQueueService;
