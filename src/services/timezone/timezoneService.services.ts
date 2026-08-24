import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { TimezoneEntity } from "../../entities/timezoneEntity";
import { TimezoneModel } from "../../database/repository/timezone/timezone.model";
import { TimezoneDto } from "../../database/repository/timezone/timezone.dto";

class TimezoneService extends BaseServices {
    constructor(entity: any = TimezoneEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): TimezoneModel {
        return new TimezoneModel();
    }

    getDTO() {
        return TimezoneDto;
    }
}

export default TimezoneService;