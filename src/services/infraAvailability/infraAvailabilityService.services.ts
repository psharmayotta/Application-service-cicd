import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { HardwareSpecsEntity } from "../../entities/hardwareSpecsEntity";
import { InfraSpecsMapperEntity } from "../../entities/infraSpecsMapperEntity";
import { InfraHardwareModuleMapperEntity } from "../../entities/infraHardwareModuleMapperEntity";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { InfraNodesEntity } from "../../entities/infraNodesEntity";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { InfraNodesStatus, InfraHardwareModuleMapperStatus } from "../../config";
import { HardwareUtilizationEntity } from "../../entities/hardwareUtilization";
import { MoreThan } from "typeorm";

export interface AvailabilityResult {
    available: boolean;
    freeCount: number;
    totalCount: number;
    allocatedCount: number;
}

export interface AcceleratorStats {
    acceleratorId: number;
    acceleratorName: string;
    total: number;
    allocated: number;
    free: number;
}

class InfraAvailabilityService {
    private awsService: AwsService;

    constructor() {
        this.awsService = new AwsService();
    }

    /**
     * Check if the requested accelerator type and count is available
     * @param acceleratorId - hardware_specs ID (GPU type)
     * @param acceleratorCount - number of GPUs required
     * @param cloudProviderId - optional cloud provider ID to filter nodes
     * @returns { available: boolean, freeCount: number, totalCount: number, allocatedCount: number }
     */
    /**
     * Check if the requested accelerator type and count is available
     * @param hardwareMasterId - hardware_master ID (e.g. A100 generic)
     * @param acceleratorCount - number of GPUs required
     * @param cloudProviderId - optional cloud provider ID to filter nodes
     * @returns { available: boolean, freeCount: number, totalCount: number, allocatedCount: number }
     */
    async checkAvailability(
        hardwareMasterId: number,
        acceleratorCount: number,
        cloudProviderId?: number
    ): Promise<AvailabilityResult> {
        try {
            // Use the utilization-based check as the primary method
            return await this.checkAvailabilityByUtilization(hardwareMasterId, acceleratorCount);
        } catch (error) {
            console.error('InfraAvailabilityService checkAvailability error:', error);
            throw error;
        }
    }

    /**
     * Get total and allocated GPU count for a specific accelerator type (Master ID)
     */
    async getAcceleratorStats(hardwareMasterId: number, cloudProviderId?: number): Promise<AcceleratorStats> {
        try {
            // Get hardware master info
            const hardwareMaster = await HardwareMasterEntity.findOne({
                where: { id: hardwareMasterId, is_delete: 0 }
            });

            if (!hardwareMaster) {
                return {
                    acceleratorId: hardwareMasterId,
                    acceleratorName: 'Unknown',
                    total: 0,
                    allocated: 0,
                    free: 0
                };
            }

            // Get all specs associated with this master ID
            const hardwareSpecs = await HardwareSpecsEntity.find({
                where: { hardware_master_id: hardwareMasterId, is_delete: 0 }
            });

            const specsIds = hardwareSpecs.map(spec => spec.id);

            if (specsIds.length === 0) {
                return {
                    acceleratorId: hardwareMasterId,
                    acceleratorName: hardwareMaster.model_name,
                    total: 0,
                    allocated: 0,
                    free: 0
                };
            }

            // Build query for nodes with ANY of these specs
            const nodesQuery = InfraNodesEntity.createQueryBuilder('nodes')
                .innerJoin(InfraSpecsMapperEntity, 'ism', 'ism.node_id = nodes.id AND ism.is_delete = 0')
                .where('ism.hardware_specs_id IN (:...specsIds)', { specsIds })
                .andWhere('nodes.is_delete = 0')
                .andWhere('nodes.status = :status', { status: InfraNodesStatus.AVAILABLE });

            if (cloudProviderId) {
                nodesQuery.andWhere('nodes.cloud_provider_id = :cloudProviderId', { cloudProviderId });
            }

            // Distinct nodes because a node might have multiple specs (though unlikely for same GPU type, but good practice)
            const nodes = await nodesQuery.getMany();

            // Filter unique nodes by ID to be safe
            const uniqueNodes = nodes.filter((node, index, self) =>
                index === self.findIndex((t) => (
                    t.id === node.id
                ))
            );

            // Calculate total GPUs available (core_count per accelerator * number of nodes)
            const coreCount = hardwareMaster.core_count || 1;
            const totalCount = uniqueNodes.length * coreCount;

            // Get currently allocated cores for this accelerator type (across all specs)
            const allocatedResult = await InfraHardwareModuleMapperEntity.createQueryBuilder('ihmm')
                .select('COALESCE(SUM(ihmm.assigned_core), 0)', 'total_allocated')
                .where('ihmm.hardware_id IN (:...specsIds)', { specsIds })
                .andWhere('ihmm.is_delete = 0')
                .andWhere('ihmm.status IN (:...statuses)', {
                    statuses: [InfraHardwareModuleMapperStatus.ASSIGNED, InfraHardwareModuleMapperStatus.RESERVED]
                })
                .getRawOne();

            const allocatedCount = parseInt(allocatedResult?.total_allocated || '0', 10);
            const freeCount = Math.max(0, totalCount - allocatedCount);

            return {
                acceleratorId: hardwareMasterId,
                acceleratorName: hardwareMaster.model_name || 'Unknown',
                total: totalCount,
                allocated: allocatedCount,
                free: freeCount
            };
        } catch (error) {
            console.error('InfraAvailabilityService getAcceleratorStats error:', error);
            throw error;
        }
    }

    /**
     * Get availability for all accelerator types
     */
    async getAllAcceleratorStats(cloudProviderId?: number): Promise<AcceleratorStats[]> {
        try {
            // Get all active hardware masters
            const hardwareMasters = await HardwareMasterEntity.find({
                where: { is_delete: 0 }
            });

            const statsPromises = hardwareMasters.map(master =>
                this.getAcceleratorStats(master.id, cloudProviderId)
            );

            return Promise.all(statsPromises);
        } catch (error) {
            console.error('InfraAvailabilityService getAllAcceleratorStats error:', error);
            throw error;
        }
    }

    /**
     * Check if specific number of GPUs can be allocated
     * Returns the first available node with sufficient capacity
     */
    async findAvailableNode(
        hardwareMasterId: number,
        acceleratorCount: number,
        cloudProviderId?: number
    ): Promise<{ nodeId: number; hostname: string } | null> {
        try {
            // Find specs for this master ID
            const hardwareSpecs = await HardwareSpecsEntity.find({
                where: { hardware_master_id: hardwareMasterId, is_delete: 0 }
            });
            const specsIds = hardwareSpecs.map(s => s.id);

            if (specsIds.length === 0) return null;

            const query = InfraNodesEntity.createQueryBuilder('nodes')
                .select([
                    'nodes.id as node_id',
                    'nodes.hostname as hostname'
                ])
                .innerJoin(InfraSpecsMapperEntity, 'ism', 'ism.node_id = nodes.id AND ism.is_delete = 0')
                .innerJoin(HardwareSpecsEntity, 'hs', 'hs.id = ism.hardware_specs_id AND hs.is_delete = 0')
                .innerJoin(HardwareMasterEntity, 'hm', 'hm.id = hs.hardware_master_id AND hm.is_delete = 0')
                .leftJoin(
                    InfraHardwareModuleMapperEntity,
                    'ihmm',
                    'ihmm.hardware_id = hs.id AND ihmm.is_delete = 0 AND ihmm.status IN (:...statuses)',
                    { statuses: [InfraHardwareModuleMapperStatus.ASSIGNED, InfraHardwareModuleMapperStatus.RESERVED] }
                )
                .where('hm.id = :hardwareMasterId', { hardwareMasterId })
                .andWhere('nodes.is_delete = 0')
                .andWhere('nodes.status = :status', { status: InfraNodesStatus.AVAILABLE })
                .groupBy('nodes.id, nodes.hostname, hm.core_count')
                .having('COALESCE(hm.core_count, 1) - COALESCE(SUM(ihmm.assigned_core), 0) >= :required', {
                    required: acceleratorCount
                });

            if (cloudProviderId) {
                query.andWhere('nodes.cloud_provider_id = :cloudProviderId', { cloudProviderId });
            }

            const result = await query.getRawOne();

            if (result) {
                return {
                    nodeId: result.node_id,
                    hostname: result.hostname
                };
            }

            return null;
        } catch (error) {
            console.error('InfraAvailabilityService findAvailableNode error:', error);
            throw error;
        }
    }

    /**
     * Check availability using HardwareUtilization table
     * @param hardwareMasterId - hardware_master ID
     * @param acceleratorCount - number of GPUs required
     */
    async checkAvailabilityByUtilization(
        hardwareMasterId: number,
        acceleratorCount: number
    ): Promise<AvailabilityResult> {
        try {
            // 1. Get Hardware Master to check core_count (capacity per node/card)
            const hardwareMaster = await HardwareMasterEntity.findOne({
                where: { id: hardwareMasterId, is_delete: 0 }
            });

            if (!hardwareMaster) {
                console.error(`HardwareMaster not found for ID: ${hardwareMasterId}`);
                return { available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 };
            }

            const capacityPerNode = hardwareMaster.core_count || 1;

            // 2. Get Hardware Specs for this Master ID
            const hardwareSpecs = await HardwareSpecsEntity.find({
                where: { hardware_master_id: hardwareMasterId, is_delete: 0 }
            });

            const specsIds = hardwareSpecs.map(s => s.id);
            if (specsIds.length === 0) {
                console.log(`No HardwareSpecs found for Master ID: ${hardwareMasterId}`);
                return { available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 };
            }

            // 3. Get Nodes associated with these Specs
            const nodes = await InfraNodesEntity.createQueryBuilder('nodes')
                .innerJoin(InfraSpecsMapperEntity, 'ism', 'ism.node_id = nodes.id AND ism.is_delete = 0')
                .where('ism.hardware_specs_id IN (:...specsIds)', { specsIds })
                .andWhere('nodes.is_delete = 0')
                .andWhere('nodes.status = :status', { status: InfraNodesStatus.AVAILABLE })
                .getMany();

            if (nodes.length === 0) {
                console.log(`No available nodes found for specs: ${specsIds.join(',')}`);
                return { available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 };
            }

            // 4. Check Utilization for each node
            let maxFreeCount = 0;
            let totalFreeCount = 0;
            let totalCapacity = 0;
            let totalAllocated = 0;

            // Look back 5 minutes for active utilization
            const timeThreshold = new Date(Date.now() - 5 * 60 * 1000);

            for (const node of nodes) {
                // Get the latest utilization record for this node
                const latestUtilization = await HardwareUtilizationEntity.findOne({
                    where: {
                        node_id: node.id,
                        timestamp: MoreThan(timeThreshold)
                    },
                    order: { timestamp: 'DESC' }
                });

                // If no recent record found, assume node is unavailable/down -> 0 free
                if (!latestUtilization) {
                    console.log(`Node ${node.id} (${node.hostname}) has no utilization records in last 5 mins. Marking as 0 free.`);
                    continue;
                }

                // Use the free_gpu_count directly from the table
                const freeCount = latestUtilization.free_gpu_count ?? 0;

                if (freeCount >= acceleratorCount) {
                    maxFreeCount = Math.max(maxFreeCount, freeCount);
                }

                totalFreeCount += freeCount;
                totalCapacity += capacityPerNode;
                // allocated is capacity - free (approximate for reporting)
                totalAllocated += Math.max(0, capacityPerNode - freeCount);
            }

            return {
                available: maxFreeCount >= acceleratorCount,
                freeCount: totalFreeCount,
                totalCount: totalCapacity,
                allocatedCount: totalAllocated
            };

        } catch (error) {
            console.error('InfraAvailabilityService checkAvailabilityByUtilization error:', error);
            throw error;
        }
    }
}

export default InfraAvailabilityService;
