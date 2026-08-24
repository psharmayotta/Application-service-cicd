export interface KafkaMessage<T = any> {
  module: string;
  member_id: number;
  company_id: number;
  entity_id: number;
  request: T;
  timestamp: string;
}