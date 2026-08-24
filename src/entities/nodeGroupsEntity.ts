import {
    Column,
    Entity,
} from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('node_groups', { schema: 'infra_schema' })
export class NodeGroupsEntity extends InferencingEntity {
    @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 50, nullable: false, default: 'active' })
    status: string;

    @Column({ type: 'integer', nullable: true })
    cluster_id: number;

    @Column({ type: 'integer', nullable: true, default: 0 })
    node_count: number;
}