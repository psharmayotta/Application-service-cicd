import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { Pagination } from "../../core/InferParams";
import { RbacRolesEntity } from "../../entities/rbacRolesEntity";
import { RbacRolesModel } from "../../database/repository/rbacRoles/rbacRoles.model";
import { RbacRolesDto } from "../../database/repository/rbacRoles/rbacRoles.dto";

class RbacRolesService extends BaseServices {
    constructor(entity: any = RbacRolesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): RbacRolesModel {
        return new RbacRolesModel();
    }

    getDTO() {
        return RbacRolesDto;
    }

    getModuleName(): string {
        return "RBAC Role";
    }

    override prepareFilter(param: Pagination): any {
        return { where: { is_delete: 0, status: 1 }, order: { id: 'ASC' } };
    }
}

export default RbacRolesService;
