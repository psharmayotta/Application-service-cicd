export interface KafkaMessage<T = any> {
  module: string;
  company_id: number;
  entity_id: number;
  request: T;
  timestamp: string;
}