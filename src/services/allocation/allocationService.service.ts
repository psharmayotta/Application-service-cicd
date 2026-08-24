import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { FileObject } from "../../core/FileModel";
import { AllocationEntity } from "../../entities/allocationEntity";
import { AllocationModel } from "../../database/repository/allocation/allocation.model";
import { AllocationDto } from "../../database/repository/allocation/allocation.dto";
import { Pagination } from "../../core/InferParams";
import * as CryptoJS from "crypto-js";
class AllocationService extends BaseServices {
    constructor(entity: any = AllocationEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): AllocationModel {
        return new AllocationModel();
    }

    getDTO() {
        return AllocationDto;
    }

    createPreProcess(model: AllocationModel, files: FileObject[] | null): Promise<AllocationModel> {
        return new Promise<AllocationModel>(async (resolve, reject) => {
            try {
                resolve(this.transformModel(model));
            } catch (error) {
                reject(error);
            }
        });
    }

    override  transformModel(model: AllocationModel): AllocationModel {
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

export default AllocationService;