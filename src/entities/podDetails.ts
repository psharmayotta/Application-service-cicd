import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';
import { NodeAntiAffinity } from '../config';

@Entity('infra_schema.pod_details')
export class PodDetailsEntity extends InferencingEntity {

  @Column({ type: 'integer', nullable: true })
  infra_allocation_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pod_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  namespace: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ type: 'integer', nullable: true })
  node_id: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  host_ip: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pod_ip: string;

  @Column({ type: 'integer', nullable: false, default: 0 })
  restart_count: number;

  @Column({ type: 'timestamp', nullable: true })
  start_time: Date;

  @Column({ type: 'timestamp', nullable: true })
  end_time: Date;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  cpu_request: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  cpu_limit: number;

  @Column({ type: 'integer', nullable: true })
  memory_request_mb: number;

  @Column({ type: 'integer', nullable: true })
  memory_limit_mb: number;

  @Column({ type: 'integer', nullable: true })
  gpu_request: number;

  @Column({ type: 'integer', nullable: true })
  gpu_memory_mb: number;

  @Column({ type: 'jsonb', nullable: true })
  volume_mounts: object;

  @Column({ type: 'jsonb', nullable: true })
  labels: object;

  @Column({ type: 'jsonb', nullable: true })
  annotations: object;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logs_path: string;

  @Column({ type: 'integer', nullable: true })
  min_pod_count: number;

  @Column({ type: 'integer', nullable: true })
  max_pod_count: number;

  @Column({ type: 'jsonb', nullable: true })
  scaling_metric: object;

  @Column({ type: 'enum', enum: NodeAntiAffinity, nullable: true })
  node_anti_affinity: NodeAntiAffinity;

  @Column({ type: 'boolean', default: false })
  rapid_autoscaling: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: object;
}


