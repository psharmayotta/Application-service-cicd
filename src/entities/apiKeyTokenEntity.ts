import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: 'admin_users_schema', name: 'api_key_token' })
export class ApiKeyTokenEntity extends InferencingEntity {

    @Column({ type: 'varchar', length: 255, nullable: false })
    api_key_name: string;

    @Column({ type: 'timestamp', nullable: false })
    generated_token_time: Date;

    @Column({ type: 'timestamp', nullable: false })
    expiry_token_time: Date;

    @Column({ type: 'varchar', length: 10, nullable: false })
    generated_year: string;

    @Column({ type: 'integer', nullable: false })
    generatedby_user_id: number;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'varchar', length: 255, nullable: false })
    generated_token: string;

    @Column({ type: 'smallint', default: 1, nullable: false })
    status: number;

    @Column({ type: 'boolean', default: true, nullable: false })
    is_playground_key: boolean;
}