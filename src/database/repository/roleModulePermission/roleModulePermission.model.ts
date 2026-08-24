import { InferModel } from "../InferModel/InferModel.model";

export class RoleModulePermissionModel extends InferModel {
    role_id: number = 0;
    module_id: number = 0;
    can_view: boolean = false;
    can_edit: boolean = false;
    can_delete: boolean = false;
    can_create: boolean = false;
} 