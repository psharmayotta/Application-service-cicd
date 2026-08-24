import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "benchmarking", name: "benchmarking_dataset" })
export class BenchmarkingDatasetEntity extends InferencingEntity {

    @Column({ type: "varchar", length: 255, nullable: false })
    dataset_name: string;

    @Column({ type: "text", nullable: true })
    purpose: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    size: string;

    @Column({ type: "integer", nullable: true })
    category_id: number;

    @Column({ type: "integer", nullable: true })
    evaluation_task_id: number;
}
