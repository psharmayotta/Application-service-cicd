import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { CloudServicesEntity } from "../../entities/cloudServiceEntity";
import { CloudServicesModel } from "../../database/repository/cloudService/cloudService.model";
import { CloudServiceDto } from "../../database/repository/cloudService/cloudService.dto";
import { CloudFilter } from "../../core/InferParams";

class CloudService extends BaseServices {
    constructor(entity: any = CloudServicesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudServicesModel {
        return new CloudServicesModel();
    }

    getDTO() {
        return CloudServiceDto;
    }

    getModuleName(): string {
        return 'Cloud Service';
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            if (!param.cloud_provider_id) {
                return Promise.reject('E10020')
            }
            const record = await this.entity.findOneBy({ c_provider_id: param.cloud_provider_id })
            return Promise.resolve(record);
        } catch (error) {
            console.log('-------CloudSecretsService prepareQuery-------', error);
            return Promise.reject(error)
        }
    }
}

export default CloudService;