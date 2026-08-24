import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { RolesEntity } from "../../entities/rolesEntity";
import { RolesModel } from "../../database/repository/roles/roles.model";
import { RolesDto } from "../../database/repository/roles/roles.dto";

class RolesService extends BaseServices {
    constructor(entity: any = RolesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): RolesModel {
        return new RolesModel();
    }

    getDTO() {
        return RolesDto;
    }
}

export default RolesService;