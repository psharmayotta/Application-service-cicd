import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ModulesEntity } from "../../entities/modulesEntity";
import { ModulesModel } from "../../database/repository/modules/modules.model";
import { MyModelDto } from "../../database/repository/MyModel/mymodel.dto";

class ModulesService extends BaseServices {
    constructor(entity: any = ModulesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ModulesModel {
        return new ModulesModel();
    }

    getDTO() {
        return MyModelDto ;
    }
}

export default ModulesService;