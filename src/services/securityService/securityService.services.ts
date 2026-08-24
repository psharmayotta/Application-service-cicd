import { AwsService } from "../../core/AwsService";
import { SecurityDto } from "../../database/repository/security/securityDto.dto";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { InferencingEntity } from "../../entities/inferenceEntity";
import { BaseServices } from "../baseService.services";

class SecurityService extends BaseServices {
    constructor(entity: any = InferencingEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InferModel {
        return new InferModel();
    }

    getDTO() {
        return SecurityDto;
    }
}

export default SecurityService;