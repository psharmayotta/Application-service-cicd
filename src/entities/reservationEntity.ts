import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "infra_schema", name: "reservation" })
export class ReservationEntity extends InferencingEntity {

    @Column({ type: "int", nullable: false })
    infra_node_id: number;

    @Column({ type: "int" })
    accelerator_count: number;

    @Column({ type: "int", nullable: false })
    region_id: number;

    @Column({ type: 'timestamp', nullable: false })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: false })
    end_date: Date;

    @Column({ type: 'int', nullable: false })
    created_by: number;

    @Column({ type: 'int', nullable: false })
    company_id: number;

    @Column({ type: 'varchar', default: 'pending' })
    status: string;

    @Column({ type: 'int', nullable: true })
    approved_by: number;
}
