import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { RoleModulePermissionEntity } from "../../entities/roleModulePermissionEntity";
import { RoleModulePermissionModel } from "../../database/repository/roleModulePermission/roleModulePermission.model";
import { RoleModulePermissionDto } from "../../database/repository/roleModulePermission/roleModulePermission.dto";

class RoleModulePermissionService extends BaseServices {
    constructor(entity: any = RoleModulePermissionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): RoleModulePermissionModel {
        return new RoleModulePermissionModel();
    }

    getDTO() {
        return RoleModulePermissionDto;
    }
}

export default RoleModulePermissionService;