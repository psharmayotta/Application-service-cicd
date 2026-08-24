
import { InferModel } from "../InferModel/InferModel.model";

export class PodLogModel extends InferModel {
  pod_name: string = '';
  status: string = '';
  infra_allocation_id: number = null;
  message: object = {};
  timestamp: Date = null;
  created_at: Date = null;
}
