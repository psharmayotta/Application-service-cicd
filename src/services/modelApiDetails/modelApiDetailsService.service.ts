import { AwsService } from "../../core/AwsService";
import { ModelAPIDetailsDto } from "../../database/repository/modelApiDetails/modelApiDetails.dto";
import { ModelAPIDetails } from "../../database/repository/modelApiDetails/modelApiDetails.model";
import { ModelAPIDetailsEntity } from "../../entities/modelApiDetailsEntity";
import { BaseServices } from "../baseService.services";

class ModelAPIDetailsService extends BaseServices {
    constructor(entity: any = ModelAPIDetailsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModelAPIDetails {
        return new ModelAPIDetails()
    }

    getDTO(): any {
        return ModelAPIDetailsDto;
    }

    getModuleName(): string {
        return 'Model API Details';
    }
}

export default ModelAPIDetailsService;