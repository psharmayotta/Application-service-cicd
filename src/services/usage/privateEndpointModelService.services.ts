import { AwsService } from "../../core/AwsService";
import { SecurityDto } from "../../database/repository/security/securityDto.dto";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { BaseServices } from "../baseService.services";
import { ModelEntity } from "../../entities/modelEntity";
import { Pagination } from "../../core/InferParams";
import Database from "../../database/database";

class PrivateEndPointModelService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InferModel {
        return new InferModel();
    }

    getDTO(): any {
        return SecurityDto;
    }

    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            if (param.company_id == undefined || param.company_id == null || typeof param.company_id !== 'number') {
                return Promise.reject('E10020')
            }

            const dbConnection = Database.getInstance()

            const getModelQuery = `
            SELECT 
                distinct(m.id) as id,
                ia.deployment_name as name,
                m.created_at,
                m.modified_at,
                m.is_delete,
                m.version,
                m.description
            FROM infra_schema.infra_allocation ia
            JOIN infra_schema.pod_details pd ON pd.infra_allocation_id = ia.id
            LEFT JOIN model.model m ON m.id = ia.module_id
            WHERE pd.status IN ('ready','end') AND ia.is_delete = 0 AND pd.is_delete = 0 AND m.is_delete = 0 AND ia.company_id = ${param.company_id}
            order by m.id DESC`;

            const privateModelList = await dbConnection.executeExternalQuery(getModelQuery, [])
            return Promise.resolve(privateModelList);
        } catch (error) {
            console.log('------error------', error);
            return Promise.reject(error)

        }
    }
}

export default PrivateEndPointModelService;