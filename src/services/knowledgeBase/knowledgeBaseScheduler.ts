import { KnowledgeBaseEntity } from "../../entities/knowledgeBaseEntity";
import KnowledgeBaseService from "./knowledgeBaseService.services";
import { LessThanOrEqual } from "typeorm";
import moment from "moment";
import { KnowledgeBaseStatus } from "../../config";

export class KnowledgeBaseScheduler {
    private static instance: KnowledgeBaseScheduler;
    private isRunning: boolean = false;
    private interval: NodeJS.Timeout | null = null;
    private knowledgeBaseService: KnowledgeBaseService;

    private constructor() {
        this.knowledgeBaseService = new KnowledgeBaseService();
    }

    public static getInstance(): KnowledgeBaseScheduler {
        if (!KnowledgeBaseScheduler.instance) {
            KnowledgeBaseScheduler.instance = new KnowledgeBaseScheduler();
        }
        return KnowledgeBaseScheduler.instance;
    }

    public start(intervalMs: number = 30 * 1000) { // Default to 30 seconds for testing
        if (this.isRunning) return;

        console.log(`[KnowledgeBaseScheduler] Starting scheduler with interval ${intervalMs}ms`);
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
        console.log("[KnowledgeBaseScheduler] Scheduler stopped");
    }

    private async run() {
        try {
            console.log("[KnowledgeBaseScheduler] Checking for due jobs...");

            const currentTime = moment().utcOffset("+05:30").toDate();

            const dueInferences = await KnowledgeBaseEntity.find({
                where: {
                    next_sync_at: LessThanOrEqual(currentTime as any),
                    auto_sync: true,
                    is_delete: 0
                }
            });

            if (dueInferences.length === 0) {
                console.log("[KnowledgeBaseScheduler] No due jobs found");
                return;
            }

            console.log(`[KnowledgeBaseScheduler] Found ${dueInferences.length} due jobs. Triggering...`);

            for (const inference of dueInferences) {
                // Ensure we don't trigger if it's already running/failed in a state we shouldn't touch
                if (inference.status === KnowledgeBaseStatus.FAILED) continue;

                try {
                    console.log(`[KnowledgeBaseScheduler] Triggering sync for Knowledge Base ${inference.id} (${inference.name})`);
                    await this.knowledgeBaseService.syncNow(inference.id, inference.company_id);
                } catch (error) {
                    console.error(`[KnowledgeBaseScheduler] Failed to trigger sync for KB ${inference.id}:`, error);
                }
            }

        } catch (error) {
            console.error("[KnowledgeBaseScheduler] Error in scheduler loop:", error);
        }
    }
}
