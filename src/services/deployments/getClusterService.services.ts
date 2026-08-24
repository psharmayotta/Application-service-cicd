import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ClustersEntity } from "../../entities/clusterEntity";
import { ClustersModel } from "../../database/repository/clusters/clusters.model";
import { ClustersDto } from "../../database/repository/clusters/clusters.dto";
import { CloudFilter, Pagination } from "../../core/InferParams";
import { ClusterStatus } from "../../config";
import { InfraNodesEntity } from "../../entities/infraNodesEntity";

class GetClusterService extends BaseServices {
    constructor(entity: any = ClustersEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ClustersModel {
        return new ClustersModel();
    }

    getDTO() {
        return ClustersDto;
    }

    getModuleName(): string {
        return 'Cluster';
    }

    // fetch the clusters along the company
    override prepareQuery(param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!param.company_id) return reject('E10020');
                const clusterData = await this.entity.find({
                    select: ['id', 'created_at', 'cluster_name', 'member_id', 'company_id', 'status'],
                    where: [
                        { company_id: param.company_id, is_delete: 0, status: ClusterStatus.ACCEPTED },
                        { is_delete: 0, status: ClusterStatus.ACCEPTED, is_default: true },
                    ]
                })
                resolve(clusterData);
            } catch (error) {
                console.log('---Clusters.prepareQuery--------', error);
                reject(error)
            }
        })
    }

    // fetch the Node Groups Along selected cluster
    override prepareQueryById(param: CloudFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!param.cluster_id) return reject('E10037');
                const nodeGroupData = await InfraNodesEntity.find({
                    select: ['id', 'created_at', 'hostname', 'location', 'cluster_id'],
                    where: { cluster_id: param.cluster_id, is_delete: 0 }
                })
                resolve(nodeGroupData);
            } catch (error) {
                console.log('---Clusters.prepareQueryById--------', error);
                reject(error)
            }
        })
    }
}

export default GetClusterService;