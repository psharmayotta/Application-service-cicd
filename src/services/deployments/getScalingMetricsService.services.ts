import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ChatFilter } from "../../core/InferParams";
import { ModelClassEntity } from "../../entities/modelClassEntity";
import { ModelClass } from "../../database/repository/modelClass/modelClass.model";
import { ModelClassDto } from "../../database/repository/modelClass/modelClass.dto";
import { ModelEntity } from "../../entities/modelEntity";

class GetScalingMetricService extends BaseServices {
    constructor(entity: any = ModelClassEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModelClass {
        return new ModelClass();
    }

    getDTO() {
        return ModelClassDto;
    }

    getModuleName(): string {
        return 'Scaling Metrics';
    }

    // fetch the scaling metric along the selected model
    override prepareQueryById(param: ChatFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!param.model_id) return reject('E10022');
                const record = await this.entity
                    .createQueryBuilder('mc')
                    .select([
                        'mc.id as id',
                        'mc.name as name',
                        'mc.abb as abb',
                        'mc.scaling_materic as scaling_metric',
                    ])
                    .innerJoin(ModelEntity, 'm', 'mc.id = m.model_class_id')
                    .where('m.id = :modelId', { modelId: param.model_id })
                    .andWhere('mc.is_delete = 0')
                    .orderBy('mc.id', 'DESC')
                    .getRawOne();
                resolve(record);
            } catch (error) {
                console.log('---GetScalingMetricService.prepareQuery--------', error);
                reject(error)
            }
        })
    }
}

export default GetScalingMetricService;