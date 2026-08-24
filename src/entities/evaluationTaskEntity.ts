import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "benchmarking", name: "evaluation_tasks" })
export class EvaluationTaskEntity extends InferencingEntity {
    @Column({ type: "varchar", length: 255, nullable: false, unique: true })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "varchar", length: 100, nullable: false })
    task_type: string; // e.g., "text_generation", "summarization", "qa", "classification"

    @Column({ type: "varchar", length: 100, nullable: true })
    category: string; // e.g., "NLP", "Vision", "Audio"

    @Column({ type: "integer", nullable: true })
    category_id: number;

    @Column({ type: "varchar", length: 255, nullable: true })
    default_dataset_path: string;

    @Column({ type: "jsonb", nullable: true })
    required_metrics: any; // e.g., {"accuracy": true, "latency": true, "throughput": true}

    @Column({ type: "jsonb", nullable: true })
    sample_input: any; // Example input for data scientists to understand task

    @Column({ type: "text", nullable: true })
    expected_output_format: string; // Description of expected output structure

    @Column({ type: "varchar", length: 50, nullable: true })
    difficulty_level: string; // "easy", "medium", "hard"

    @Column({ type: "integer", nullable: true })
    estimated_tokens: number; // Approximate tokens required for this task

    @Column({ type: "boolean", default: true })
    is_active: boolean; // Whether task is available for use

    @Column({ type: "text", nullable: true })
    icon: string;
}
