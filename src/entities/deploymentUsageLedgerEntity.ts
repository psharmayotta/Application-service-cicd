import { Entity, Column } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "infra_schema", name: "deployment_usage_ledger" })
export class DeploymentUsageLedgerEntity extends InferencingEntity {

    @Column({ type: "integer" })
    infra_allocation_id: number;

    @Column({ type: "varchar", length: 50 })
    event_type: string;

    @Column({ type: "integer" })
    gpu_count_change: number;

    @Column({ type: "integer" })
    total_gpu_after: number;

    @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
    event_timestamp: Date;
}
