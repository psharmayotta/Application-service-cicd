import { ClusterEnvironment, ClusterStatus, ClusterType } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class ClustersModel extends InferModel {
    cluster_name: string = '';
    member_id: number = null;
    company_id: number = null;
    cloud_account_id: number = null;
    cloud_region_id: number = null;
    hosted_zone_id: number = null;
    tags: any[] = null;
    env: ClusterEnvironment = ClusterEnvironment.PRODUCTION;
    custom_env_description: string = '';
    enable_install_training_tooling: boolean = false;
    cluster_type: ClusterType = ClusterType.CREATED;
    status: ClusterStatus = ClusterStatus.QUEUED;
}