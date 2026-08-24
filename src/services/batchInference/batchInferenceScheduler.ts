import { BatchInferenceEntity } from "../../entities/batchInferenceEntity";
import { BatchInferenceService } from "./batchInference.service";
import { LessThanOrEqual } from "typeorm";
import moment from "moment";

export class BatchInferenceScheduler {
    private static instance: BatchInferenceScheduler;
    private isRunning: boolean = false;
    private interval: NodeJS.Timeout | null = null;
    private batchInferenceService: BatchInferenceService;

    private constructor() {
        this.batchInferenceService = new BatchInferenceService();
    }

    public static getInstance(): BatchInferenceScheduler {
        if (!BatchInferenceScheduler.instance) {
            BatchInferenceScheduler.instance = new BatchInferenceScheduler();
        }
        return BatchInferenceScheduler.instance;
    }

    public start(intervalMs: number = 30 * 1000) { // Default to 30 seconds for testing
        if (this.isRunning) return;

        console.log(`[BatchScheduler] Starting scheduler with interval ${intervalMs}ms`);
        this.isRunning = true;

        this.interval = setInterval(() => {
            this.run();
        }, intervalMs);

        // Run immediately on start (with a slight delay to ensure DB connects first)
        setTimeout(() => this.run(), 5000);
    }

    public stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        console.log("[BatchScheduler] Scheduler stopped");
    }

    private async run() {
        try {
            console.log("[BatchScheduler] Checking for due jobs...");

            const currentTimeStr = moment().utcOffset("+05:30").format("YYYY-MM-DD HH:mm:ss");

            const dueInferences = await BatchInferenceEntity.find({
                where: {
                    next_run_at: LessThanOrEqual(currentTimeStr as any),
                    is_active: true,
                    is_sync_enabled: true,
                    is_delete: 0
                }
            });

            if (dueInferences.length === 0) {
                console.log("[BatchScheduler] No due jobs found");
                return;
            }

            console.log(`[BatchScheduler] Found ${dueInferences.length} due jobs. Triggering...`);

            for (const inference of dueInferences) {
                try {
                    console.log(`[BatchScheduler] Triggering job for inference ${inference.id} (${inference.name})`);
                    await this.batchInferenceService.runInference(inference.id);
                } catch (error) {
                    console.error(`[BatchScheduler] Failed to trigger job for inference ${inference.id}:`, error);
                }
            }

        } catch (error) {
            console.error("[BatchScheduler] Error in scheduler loop:", error);
        }
    }
}
