import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "v0_dev_yotta", name: "deployment_quota" })
export class DeploymentQuotaEntity extends InferencingEntity {

    @Column({ type: "int" })
    tpm_limit: number;

    @Column({ type: "int" })
    rpm_limit: number;

    @Column({ type: "int" })
    model_id: number;

    @Column({ type: "int" })
    company_id: number;

    @Column({ type: "int" })
    extended_tpm_limit: number;

    @Column({ type: "int" })
    extended_rpm_limit: number;

    @Column({ type: "varchar" })
    status: string;

    @Column({ type: "int", default: 1 })
    is_default: number;

    @Column({ type: "text", nullable: true })
    reason: string;

    @Column({ type: "int", nullable: true })
    requested_by: number;

    @Column({ type: "varchar", nullable: true })
    request_for: string;

    @Column({ type: "int", default: 0 })
    max_tpm_limit: number;

    @Column({ type: "int", default: 0 })
    max_rpm_limit: number;

    @Column({ type: "varchar", nullable: true })
    module_type: string;
}
