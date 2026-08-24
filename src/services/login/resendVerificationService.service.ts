import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ResendVerificationModel } from "../../database/repository/login/resendVerification/resendVerification.model";
import { ResendVerificationDto } from "../../database/repository/login/resendVerification/resendVerification.dto";

class ResendVerificationService extends BaseServices {
	constructor(entity: any, protected awsService: AwsService = new AwsService()) {
		super(entity, awsService);
	}

	getModel(): ResendVerificationModel {
		return new ResendVerificationModel();
	}

	getDTO() {
		return ResendVerificationDto;
	}
}

export default ResendVerificationService;
