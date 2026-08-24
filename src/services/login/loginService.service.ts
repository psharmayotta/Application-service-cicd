import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { LoginModel } from "../../database/repository/login/login/login.model";
import { LoginDto } from "../../database/repository/login/login/login.dto";

class LoginService extends BaseServices {
	constructor(entity: any, protected awsService: AwsService = new AwsService()) {
		super(entity, awsService);
	}

	getModel(): LoginModel {
		return new LoginModel();
	}

	getDTO() {
		return LoginDto;
	}
}

export default LoginService;
