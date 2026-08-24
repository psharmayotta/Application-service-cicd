import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { BenchmarkingType } from "../config";

@Entity({ schema: "benchmarking", name: "benchmarking" })
export class BenchmarkingEntity extends InferencingEntity {
    @Column({ type: "integer", nullable: true })
    company_id: number;

    @Column({ type: "integer", nullable: true })
    member_id: number;

    @Column({ type: "varchar", length: 255, nullable: false })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "varchar", length: 255, nullable: false })
    benchmarking_type: BenchmarkingType;

    @Column({ type: "integer", nullable: true })
    model_category_id: number;

    @Column({ type: "integer", nullable: true })
    model_source_id: number;

    @Column({ type: "integer", nullable: true })
    model_2_source_id: number;

    @Column({ type: "text", nullable: true })
    model_path: string;

    @Column({ type: "text", nullable: true })
    model_2_path: string;

    @Column({ type: "integer", nullable: true })
    model_class_id: number;

    @Column({ type: "integer", nullable: true })
    model_2_class_id: number;

    @Column({ type: "varchar", length: 100, nullable: true })
    model_type: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    model_2_type: string;

    @Column({ type: "integer", nullable: true })
    base_model: number;

    @Column({ type: "integer", nullable: true })
    base_model_2: number;

    @Column({
        type: "jsonb",
        nullable: true,
    })
    dataset_id: any;

    @Column({ type: "jsonb", nullable: true })
    concurrent_users: number[];

    @Column({ type: "integer", nullable: true })
    gpu_type: number;

    @Column({ type: "integer", nullable: true })
    gpu_count_per_node: number;

    @Column({ type: "integer", nullable: true })
    hardware_1_gpu_type: number;

    @Column({ type: "integer", nullable: true })
    hardware_1_gpu_count_per_node: number;

    @Column({ type: "integer", nullable: true })
    hardware_2_gpu_type: number;

    @Column({ type: "integer", nullable: true })
    hardware_2_gpu_count_per_node: number;

    @Column({ type: "jsonb", nullable: true })
    inference_setting: any;

    @Column({ type: "jsonb", nullable: true })
    inference_setting2: any;

    @Column({ type: "integer", nullable: true })
    cloud_secret_id_1: number;

    @Column({ type: "integer", nullable: true })
    cloud_secret_id_2: number;

    @Column({ type: "varchar", length: 255, nullable: true })
    base_model_1_category: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    base_model_2_category: string;

    @Column({ type: "integer", nullable: true })
    ai_model: number;

    @Column({ type: "text", nullable: true })
    prompt: string;

    @Column({ type: "varchar", length: 50, nullable: true, default: "Pending" })
    status: string;

    @Column({ type: "jsonb", nullable: true })
    results_1: any;

    @Column({ type: "jsonb", nullable: true })
    results_2: any;

    @Column({ type: "varchar", length: 100, nullable: true, default: "Pending" })
    model_1_status: string;

    @Column({ type: "varchar", length: 100, nullable: true, default: "Pending" })
    model_2_status: string;

    @Column({ type: "integer", nullable: true })
    evaluation_task_id: number;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
    execution_time: number;

    @Column({ type: "integer", nullable: true })
    knowledgebase_id: number;
}
