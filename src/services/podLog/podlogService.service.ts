import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { NodeGroupsModel } from "../../database/repository/nodeGroups/nodeGroupes.model";
import { PodLogModel } from "../../database/repository/podLog/podLog.model";
import { NodeGroupsEntity } from "../../entities/nodeGroupsEntity";
import { PodLogEntity } from "../../entities/podLogEntity";
import { BaseServices } from "../baseService.services";

class PodLogService extends BaseServices {
    constructor(entity: any = PodLogEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): PodLogModel {
        return new PodLogModel();
    }

    getDTO() {
        return '';
    }

}

export default PodLogService;