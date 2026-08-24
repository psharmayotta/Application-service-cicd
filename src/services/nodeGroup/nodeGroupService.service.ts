import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { NodeGroupsModel } from "../../database/repository/nodeGroups/nodeGroupes.model";
import { NodeGroupsEntity } from "../../entities/nodeGroupsEntity";
import { BaseServices } from "../baseService.services";

class NodeGroupsService extends BaseServices {
    constructor(entity: any = NodeGroupsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): NodeGroupsModel {
        return new NodeGroupsModel();
    }

    getDTO() {
        return '';
    }

    override prepareFilter(param: Pagination): any {
        const filter = super.prepareFilter(param)
        filter.where = { ...filter.where, cluster_id: param.id }
        return filter;
    }

}

export default NodeGroupsService;