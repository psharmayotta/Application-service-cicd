import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "guardrails", name: "guardrails" })
export class GuardrailsEntity extends InferencingEntity {
    @Column({ type: "integer", nullable: false })
    company_id: number;

    @Column({ type: "integer", nullable: false })
    member_id: number;

    @Column({ type: "varchar", length: 255, nullable: false })
    guardrail_name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ type: "integer", nullable: false })
    model_category_id: number;

    @Column({ type: "jsonb", nullable: true })
    configure_filters: any;

    @Column({ type: "boolean", default: false })
    prompt_injection: boolean;

    @Column({ type: "boolean", default: false })
    content_moderation: boolean;

    @Column({ type: "boolean", default: false })
    topic_policy: boolean;

    @Column({ type: "boolean", default: false })
    word_policy: boolean;

    @Column({ type: "boolean", default: false })
    pii_policy: boolean;

    @Column({ type: "boolean", default: false })
    image_content: boolean;

    @Column({ type: "text", nullable: true })
    blocked_input_message: string;

    @Column({ type: "text", nullable: true })
    blocked_output_message: string;
}
