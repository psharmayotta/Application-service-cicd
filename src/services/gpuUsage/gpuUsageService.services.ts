import { DeploymentUsageLedgerEntity } from "../../entities/deploymentUsageLedgerEntity";
import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";

class GpuUsageService extends BaseServices {
    constructor(entity: any = DeploymentUsageLedgerEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    /**
     * Tracks a GPU scaling event in the ledger.
     * @param infraAllocationId The ID of the deployment allocation.
     * @param eventType 'POD_START' | 'POD_STOP' | 'SCALE_UP' | 'SCALE_DOWN'
     * @param gpuChange The number of GPUs added (positive) or removed (negative).
     * @param eventTimestamp Optional timestamp of the event (defaults to now).
     */
    async trackEvent(infraAllocationId: number, eventType: string, gpuChange: number, eventTimestamp: Date = new Date()): Promise<DeploymentUsageLedgerEntity> {
        // 1. Find the latest entry for this allocation to calculate the running total
        const lastEntry = await DeploymentUsageLedgerEntity.findOne({
            where: { infra_allocation_id: infraAllocationId, is_delete: 0 },
            order: { event_timestamp: 'DESC', id: 'DESC' }
        });

        const previousTotal = lastEntry ? lastEntry.total_gpu_after : 0;
        const newTotal = Math.max(0, previousTotal + gpuChange);

        // 2. Create the new ledger entry
        const newEntry = new DeploymentUsageLedgerEntity();
        newEntry.infra_allocation_id = infraAllocationId;
        newEntry.event_type = eventType;
        newEntry.gpu_count_change = gpuChange;
        newEntry.total_gpu_after = newTotal;
        newEntry.event_timestamp = eventTimestamp;

        return await newEntry.save();
    }

    /**
     * Calculates the cumulative GPU-seconds for a deployment up to a specific time.
     * Uses Discrete Integration (Area Under Curve).
     * @param infraAllocationId The ID of the deployment allocation.
     * @param endTime The end of the billing period.
     */
    async calculateUsageSeconds(infraAllocationId: number, endTime: Date = new Date()): Promise<number> {
        const entries = await DeploymentUsageLedgerEntity.find({
            where: { infra_allocation_id: infraAllocationId, is_delete: 0 },
            order: { event_timestamp: 'ASC' }
        });

        if (entries.length === 0) return 0;

        let totalGpuSeconds = 0;

        for (let i = 0; i < entries.length; i++) {
            const currentEntry = entries[i];
            const nextTimestamp = (i + 1 < entries.length) 
                ? new Date(entries[i+1].event_timestamp).getTime() 
                : endTime.getTime();
            
            const currentTimestamp = new Date(currentEntry.event_timestamp).getTime();
            const durationSeconds = Math.max(0, (nextTimestamp - currentTimestamp) / 1000);
            
            totalGpuSeconds += currentEntry.total_gpu_after * durationSeconds;
        }

        return totalGpuSeconds;
    }

    getModel() { return null; }
    getDTO() { return null; }
}

export default GpuUsageService;
