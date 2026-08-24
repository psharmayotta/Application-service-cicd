import { AwsService } from "../../core/AwsService";
import { InferencingEntity } from "../../entities/inferenceEntity";
import { BaseServices } from "../baseService.services";
import { APIHealthCheckModel } from "../../database/repository/apiHealthCheck/apiHealthCheck.model";
import { APIHealthCheckDto } from "../../database/repository/apiHealthCheck/apiHealthCheck.dto";
import PodDetailsService from "../podDetails/podDetailsService.service";

class APIHealthCheckService extends BaseServices {
  constructor(
    entity: any = InferencingEntity,
    protected awsService: AwsService = new AwsService()
  ) {
    super(entity, awsService);
  }

  getModel(): APIHealthCheckModel {
    return new APIHealthCheckModel();
  }

  getDTO() {
    return APIHealthCheckDto;
  }

  public apiHealthCheck(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        resolve(`API Server is up and running successfully!`);
      } catch (error) {
        console.log("-----------APIHealthCheckService Error-----------", error);
        reject(error);
      }
    });
  }
}

export default APIHealthCheckService;
