import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ClustersEntity } from "../../entities/clusterEntity";
import { ClustersModel } from "../../database/repository/clusters/clusters.model";
import { ClustersDto } from "../../database/repository/clusters/clusters.dto";
import { Pagination } from "../../core/InferParams";
import { ClusterStatus } from "../../config";

class ClustersService extends BaseServices {
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

    override prepareQuery(param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!param.company_id) reject('E10020');
                const clusterData = await this.entity.find({
                    select: ['id', 'created', 'cluster_name', 'member_id', 'company_id', 'status'],
                    where: { company_id: param.company_id, is_delete: 0, status: ClusterStatus.ACCEPTED }
                })
                resolve(clusterData);
            } catch (error) {
                console.log('---Clusters.prepareQuery--------', error);
                reject(error)
            }
        })
    }
}

export default ClustersService;