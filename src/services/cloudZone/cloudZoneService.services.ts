import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { CloudZoneEntity } from "../../entities/cloudZoneEntity";
import { CloudZoneModel } from "../../database/repository/cloudZone/cloudZone.model";
import { CloudZoneDto } from "../../database/repository/cloudZone/cloudZone.dto";
import { ChatFilter, CloudFilter, Pagination } from "../../core/InferParams";

class CloudZoneService extends BaseServices {
    constructor(entity: any = CloudZoneEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudZoneModel {
        return new CloudZoneModel();
    }

    getDTO() {
        return CloudZoneDto;
    }

    getModuleName(): string {
        return 'Cloud Zone'
    }

    override prepareQuery(param: CloudFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const whereCondition = param.cloud_provider_id ? { c_provider_id: param.cloud_provider_id, is_delete: 0 } : { is_delete: 0 };
                const records = await this.entity.findBy(whereCondition)
                const totalRecords = records.length > 0 ? records.length : 0
                resolve({ records, totalRecords });
            } catch (error) {
                console.log('-----cloud zone service prepare query error-----', error);
                reject(error);
            }
        });
    }

}

export default CloudZoneService;