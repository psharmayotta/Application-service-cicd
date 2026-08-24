import { Column, Entity } from 'typeorm';
import { InferencingEntity } from './inferenceEntity';

@Entity('infra_schema.hardware_utilization')
export class HardwareUtilizationEntity extends InferencingEntity {

  @Column({ type: 'integer', nullable: true })
  pod_id: number;

  @Column({ type: 'integer', nullable: true })
  infra_allocation_id: number;

  @Column({ type: 'integer', nullable: true })
  node_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  container_name: string;

  @Column({ type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  cpu_usage_cores: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  cpu_usage_percent: number;

  @Column({ type: 'integer', nullable: true })
  memory_usage_mb: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  memory_percent: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  gpu_usage_percent: number;

  @Column({ type: 'integer', nullable: true })
  gpu_memory_used_mb: number;

  @Column({ type: 'bigint', nullable: true })
  network_rx_bytes: number;

  @Column({ type: 'bigint', nullable: true })
  network_tx_bytes: number;

  @Column({ type: 'bigint', nullable: true })
  disk_read_bytes: number;

  @Column({ type: 'bigint', nullable: true })
  disk_write_bytes: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics_metadata: object;

  @Column({ type: 'integer', nullable: true })
  hardware_specs_id: number;

  @Column({ type: 'integer', nullable: true })
  free_gpu_count: number;
}
