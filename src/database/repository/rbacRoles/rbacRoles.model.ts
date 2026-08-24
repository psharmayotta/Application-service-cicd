import { InferModel } from "../InferModel/InferModel.model";

export class RbacRolesModel extends InferModel {
    role_name: string = '';
    description: string = '';
    status: number = 1;
}
