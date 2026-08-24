import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { CloudSecretsModel } from '../../database/repository/cloudSecrets/cloudSecrets.model';
import { CloudSecretsDto } from '../../database/repository/cloudSecrets/cloudSecrets.dto';
import { CloudFilter, Pagination } from '../../core/InferParams';
import { CloudRegionEntity } from '../../entities/cloudRegionEntity';
import { CountryMasterEntity } from '../../entities/countryEntity';

class CloudRegionService extends BaseServices {
    constructor(entity: any = CloudRegionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudSecretsModel {
        return new CloudSecretsModel();
    }

    getDTO() {
        return CloudSecretsDto;
    }

    getModuleName(): string {
        return 'Cloud Region';
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            if (!param.cloud_provider_id) {
                return Promise.reject('E10027')
            }

            // const record = await this.entity.findBy({ c_provider_id: param.cloud_provider_id, is_delete: 0 })
            const record = await this.entity
                .createQueryBuilder('cr')
                .leftJoinAndSelect(CountryMasterEntity, 'ct', 'ct.id = cr.country_id AND ct.is_delete = 0')
                .where('cr.c_provider_id = :providerId', { providerId: param.cloud_provider_id })
                .andWhere('cr.is_delete = 0')
                .select([
                    'cr.id AS id',
                    'cr.created_at as created_at',
                    'cr.modified_at as modified_at',
                    'cr.is_delete as is_delete',
                    'cr.c_provider_id as c_provider_id',
                    'cr.zone_id as zone_id',
                    'cr.name AS name',
                    'cr.region_name AS region_name',
                    'cr.region_code AS region_code',
                    'cr.status AS status',
                    'cr.country_id AS country_id',
                    'ct.country_name AS country_name',
                    'ct.country_flag_image AS country_flag_image'
                ])
                .getRawMany();

            return Promise.resolve(record);
        } catch (error) {
            console.log('-------CloudRegionService prepareQuery-------', error);
            return Promise.reject(error)
        }
    }
}

export default CloudRegionService;
