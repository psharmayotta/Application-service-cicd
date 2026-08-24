import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { VerifyEmailModel } from "../../database/repository/login/verifyEmail/verifyEmail.model";
import { VerifyEmailDto } from "../../database/repository/login/verifyEmail/verifyEmail.dto";

class VerifyEmailService extends BaseServices {
	constructor(entity: any, protected awsService: AwsService = new AwsService()) {
		super(entity, awsService);
	}

	getModel(): VerifyEmailModel {
		return new VerifyEmailModel();
	}

	getDTO() {
		return VerifyEmailDto;
	}
}

export default VerifyEmailService;
