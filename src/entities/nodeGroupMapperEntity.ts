import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { InfraNodesEntity } from "./infraNodesEntity";
import { NodeGroupsEntity } from "./nodeGroupsEntity";
import { InferencingEntity } from "./inferenceEntity";

@Entity('node_groups', { schema: 'node_group_mapper' })
export class NodeGroupMembersEntity extends InferencingEntity {
  @Column({ type: 'integer', nullable: false })
  node_id: number;

  @Column({ type: 'integer', nullable: false })
  node_group_id: number;

  @ManyToOne(() => InfraNodesEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: InfraNodesEntity;

  @ManyToOne(() => NodeGroupsEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_group_id' })
  node_group: NodeGroupsEntity;
}