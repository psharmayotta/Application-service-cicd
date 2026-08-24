import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('v0_dev_admin_yotta.contact_us')
export class ContactUsEntity extends InferencingEntity {

    @Column({ type: 'varchar' })
    model_name: string;

    @Column({ type: 'varchar' })
    email: string;
}
