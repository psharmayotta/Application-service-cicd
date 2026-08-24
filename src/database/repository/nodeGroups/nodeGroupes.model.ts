import { InferModel } from '../InferModel/InferModel.model';

export class NodeGroupsModel extends InferModel {
  name: string = '';
  description: string = '';
  status: string = 'active';
  cluster_id: number | null = null;
  node_count: number = 0;
}