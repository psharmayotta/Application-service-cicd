import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_yotta.notification_tbl')
export class NotificationEntity extends InferencingEntity {

    @Column({ type: 'integer', nullable: false })
    user_id: number;

    @Column({ type: 'varchar', length: 100, nullable: false })
    notification_type: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    module_name: string;

    @Column({ type: 'boolean', default: false })
    is_readed: boolean;

    @Column({ type: 'integer', nullable: false })
    company_id: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    message: string;
}
