import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { CloudProviderModel } from '../../database/repository/cloudProvider/cloudProvider.model';
import { CloudFilter } from '../../core/InferParams';
import { CloudSecretsEntity } from '../../entities/cloudSecretsEntity';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CLOUDFRONTBASEURL } from '../../config';
import { MembersEntity } from '../../entities/membersEntity';
import { CloudProviderDto } from '../../database/repository/cloudProvider/cloudProvider.dto';

class GetCloudSecretService extends BaseServices {
    constructor(entity: any = CloudSecretsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudProviderModel {
        return new CloudProviderModel();
    }

    getDTO(): any {
        return CloudProviderDto;
    }

    getModuleName(): string {
        return 'Cloud Secret';
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            if (!param.cloud_provider_id) {
                return Promise.reject('E10027')
            }
            if (!param.company_id) {
                return Promise.reject('E10020')
            }

            const cloudSecretData = await this.entity.find({
                where: {
                    is_delete: 0,
                    c_provider_id: param.cloud_provider_id,
                    company_id: param.company_id
                },
                order: { id: 'DESC' }
            });

            if (cloudSecretData) {
                const cloudProviderData = await CloudProviderEntity.findOneBy({ id: param.cloud_provider_id, is_delete: 0 })
                for (const secretData of cloudSecretData) {
                    secretData.cloud_provider_name = cloudProviderData ? cloudProviderData.name : '';
                    secretData.cloud_provider_image = cloudProviderData ? await this.generateSignedUrl('cloudProviderMedia', cloudProviderData.id, cloudProviderData.cloud_provider_image) : '';
                    const memberdetails = await MembersEntity.findOneBy({ id: secretData.member_id, is_delete: 0 })
                    secretData.member_name = memberdetails ? memberdetails.full_name : '';
                    secretData.email = memberdetails ? memberdetails.email : '';
                }
            }
            return Promise.resolve(cloudSecretData);
        } catch (error) {
            console.log('-----CloudProviderService prepareQuery-----', error);
            return Promise.reject(error)
        }
    }
}

export default GetCloudSecretService;
