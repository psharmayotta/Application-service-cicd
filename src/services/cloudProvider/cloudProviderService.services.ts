import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CloudProviderModel } from '../../database/repository/cloudProvider/cloudProvider.model';
import { CloudFilter, Pagination } from '../../core/InferParams';
import { MetaModel } from '../../core/MetaModel';
import { ModuleType } from '../../config';
import { CloudProviderDto } from '../../database/repository/cloudProvider/cloudProvider.dto';

class CloudProviderServices extends BaseServices {
    constructor(entity: any = CloudProviderEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudProviderModel {
        return new CloudProviderModel();
    }

    getDTO(): any {
        return CloudProviderDto;
    }

    getModuleName(): string {
        return 'Cloud Provider';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('cloudProviderMedia', 'cloud_provider_image', [{ fileKey: "cloud_provider_image", allowedSize: 5767168, require: "true", allowedExtensions: ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'], colName: "cloud_provider_image" }])
    }


    override async transformFileData(model: CloudProviderModel, files: any): Promise<any> {
        try {
            let fileData = null
            if (files.length > 0) {
                fileData = {
                    ...model,
                    cloud_provider_image: files[0].cloud_provider_image
                }
            } else {
                fileData = {
                    ...model,
                    files
                }
            }

            return Promise.resolve(fileData)
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override prepareFilter(param: Pagination): any {
        const filter = super.prepareFilter(param)
        filter.where = { ...filter.where, cloud_secret_activation: true }
        filter.order = { created_at: 'ASC' }
        return filter;
    }

    override postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result && result.length > 0) {
                    for (const res of result) {
                        res.signedURL_cloud_provider_image = res.cloud_provider_image
                            ? await this.generateSignedUrl(this.getMetaModel()?.modelName, res.id, res.cloud_provider_image)
                            : ''
                    }
                }
                resolve(result);
            } catch (error) {
                console.log('-------CloudProviderService postProcessAfterGetData--', error);
                reject(error)
            }
        });
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            let cloudProviderData = null;

            switch (param.module_name) {
                case ModuleType.TRAINING:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, training_activation: true },
                            { is_delete: 0, is_default: true }
                        ],
                        order: { created_at: 'ASC' }
                    });
                    cloudProviderData = await Promise.all(
                        cloudProviderData.map(async (item: any) => ({
                            ...item,
                            cloud_provider_icon: item.cloud_provider_icon
                                ? await this.generateSignedUrl(
                                    'cloudProviderMedia',
                                    item.id,
                                    item.cloud_provider_icon
                                )
                                : ''
                        }))
                    );
                    break;

                case ModuleType.MYMODEL:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, my_model_activation: true },
                            { is_delete: 0, is_default: true }
                        ],
                        order: { created_at: 'ASC' }
                    });
                    break;
                case ModuleType.COMPILE:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, compile_activation: true },
                        ],
                        order: { created_at: 'ASC' }
                    });
                    break;

                case ModuleType.BENCHMARKING:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, benchmarking_activation: true },
                        ],
                    });
                    break;
                case ModuleType.RAG:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, rag_activation: true },
                        ]
                    });
                    break;
                default:
                    cloudProviderData = await this.entity.find({
                        where: [
                            { is_delete: 0, cloud_account_activation: true },
                            { is_delete: 0, is_default: true }
                        ],
                        order: { created_at: 'ASC' }
                    });
                    break;
            }

            return Promise.resolve(cloudProviderData);
        } catch (error) {
            console.log('-----CloudProviderService prepareQuery-----', error);
            return Promise.reject(error);
        }
    }


    override postProcessAfterGetAll(result: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result && result.length > 0) {
                    for (const res of result) {
                        res.signedURL_cloud_provider_image = res.cloud_provider_image
                            ? await this.generateSignedUrl(this.getMetaModel()?.modelName, res.id, res.cloud_provider_image)
                            : ''
                    }
                }
                resolve(result);
            } catch (error) {
                console.log('-------CloudProviderService postProcessAfterGetData--', error);
                reject(error)
            }
        });
    }


    override async prepareQueryById(param: Pagination): Promise<any> {
        try {
            const data = await this.entity.findOneBy({ id: param.id, is_delete: 0 })
            return Promise.resolve(data);
        } catch (error) {
            console.log('-----CloudProviderService prepareQueryById-----', error);
            return Promise.reject(error)
        }
    }

    override postProcessGetById(result: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result) {
                    result.signedURL_cloud_provider_image = result.cloud_provider_image
                        ? await this.generateSignedUrl(this.getMetaModel()?.modelName, result.id, result.cloud_provider_image)
                        : ''
                }
                resolve(result);
            } catch (error) {
                console.log('-----CloudAccountService postProcessGetById-----', error);
                return Promise.reject(error)
            }

        });
    }

}

export default CloudProviderServices;
