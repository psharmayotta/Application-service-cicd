import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { FileObject } from "../../core/FileModel";
import { AllocationEntity } from "../../entities/allocationEntity";
import { AllocationModel } from "../../database/repository/allocation/allocation.model";
import { AllocationDto } from "../../database/repository/allocation/allocation.dto";
import { HardwareUtilizationEntity } from "../../entities/hardwareUtilization";
import { HardwareUtilizationModel } from "../../database/repository/hardwareUtilization/hardwareUtilization.model";
import { HardwareUtilizationDto } from "../../database/repository/hardwareUtilization/hardwareUtilization.dto";
import { Pagination } from "../../core/InferParams";
import * as CryptoJS from "crypto-js";

class HardwareUtilizationService extends BaseServices {
    constructor(entity: any = HardwareUtilizationEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): HardwareUtilizationModel {
        return new HardwareUtilizationModel();
    }

    getDTO() {
        return HardwareUtilizationDto;
    }

    createPreProcess(model: HardwareUtilizationModel, files: FileObject[] | null): Promise<HardwareUtilizationModel> {
        return new Promise<HardwareUtilizationModel>(async (resolve, reject) => {
            try {
                resolve(this.transformModel(model));
            } catch (error) {
                reject(error);
            }
        });
    }

    override  transformModel(model: HardwareUtilizationModel): HardwareUtilizationModel {
        return model;
    }

    async prepareQueryById(param: Pagination): Promise<any> {
        try {
            const record = await this.entity
                .createQueryBuilder('e')
                .select('*')
                .where('e.is_delete = 0')
                .andWhere('e.id = :id', { id: param.id })
                .getRawOne();

            if (record) {
                record.hashId = CryptoJS.MD5(record.id.toString()).toString();
            }

            return record;
        } catch (error) {
            console.log('-----HostedZoneService prepareQueryById-----', error);
            throw error;
        }
    }
}

export default HardwareUtilizationService;