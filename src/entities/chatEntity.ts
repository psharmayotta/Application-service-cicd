import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('chat_schema.chat')
export class ChatEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    chat_session_id: number;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'text', nullable: false })
    user_message: string;

    @Column({ type: 'text', nullable: true })
    bot_response: string;

    @Column({ type: 'double precision', nullable: true })
    input_word_count: number;

    @Column({ type: 'double precision', nullable: true })
    output_word_count: number;
}
