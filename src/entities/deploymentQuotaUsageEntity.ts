import { Entity, Column } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "v0_dev_yotta", name: "deployment_quota_usage" })
export class DeploymentQuotaUsageEntity extends InferencingEntity {

    @Column({ type: "timestamp" })
    minute_bucket: Date;

    @Column({ type: "double precision", default: 0 })
    tpm_used: number;

    @Column({ type: "int", default: 0 })
    rpm_used: number;

    @Column({ type: "int", default: null })
    company_id: number;

    @Column({ type: "int" })
    model_id: number;
}