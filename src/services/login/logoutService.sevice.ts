import { AwsService } from "../../core/AwsService";
import { LogoutDto } from "../../database/repository/logout/logout.dto";
import { LogoutModel } from "../../database/repository/logout/logout.model";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { BaseServices } from "../baseService.services";

class LogoutService extends BaseServices {
    constructor(entity: any = MemberLoginsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): LogoutModel {
        return new LogoutModel()
    }

    getDTO(): any {
        return LogoutDto;
    }

    getModuleName(): string {
        return 'Logout';
    }


    logout(model: LogoutModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(`Logout Successfully`);
            } catch (error) {
                reject(error);
            }
        });
    }

}

export default LogoutService;