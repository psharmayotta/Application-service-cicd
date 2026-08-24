import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('chat_schema.chat_session')
export class ChatSessionEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    member_id: number;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'varchar', length: 255, nullable: false })
    api_key: string;

    @Column({ type: 'integer', nullable: false })
    model_id: number;

    @Column({ type: 'varchar', length: 255, nullable: false })
    session_id: string;

    @Column({ type: 'timestamp', nullable: false })
    session_start_time: Date;

    @Column({ type: 'timestamp', nullable: true })
    session_end_time: Date;

    @Column({ type: 'interval', nullable: true })
    session_duration: any;
}
