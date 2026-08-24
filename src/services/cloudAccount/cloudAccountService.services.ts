import CryptoJS from 'crypto-js';
import { Not } from 'typeorm';
import { AwsService } from '../../core/AwsService';
import { FileObject } from '../../core/FileModel';
import { CloudFilter, Pagination } from '../../core/InferParams';
import { CloudAccountDto } from '../../database/repository/cloudAccount/cloudAccount.dto';
import { CloudAccountModel } from '../../database/repository/cloudAccount/cloudAccount.model';
import { CloudAccountEntity } from '../../entities/cloudAccountEntity';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CloudRegionEntity } from '../../entities/cloudRegionEntity';
import { CloudSecretsEntity } from '../../entities/cloudSecretsEntity';
import { CountryMasterEntity } from '../../entities/countryEntity';
import { MembersEntity } from '../../entities/membersEntity';
import { BaseServices } from '../baseService.services';

class CloudAccountService extends BaseServices {
    constructor(entity: any = CloudAccountEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudAccountModel {
        return new CloudAccountModel();
    }

    getDTO(): any {
        return CloudAccountDto;
    }

    getModuleName(): string {
        return 'Cloud Account';
    }

    override createPreProcess(model: CloudAccountModel, files: FileObject[] | null): Promise<CloudAccountModel> {
        return new Promise<CloudAccountModel>(async (resolve, reject) => {
            try {
                const checkNameExist = await this.entity.findOneBy({ account_name: model.account_name, company_id: model.company_id, is_delete: 0 });
                if (checkNameExist && model.id === undefined) return reject('E10061');
                // name unique
                const whereCondition = model.id ?
                    { id: Not(model.id), account_name: model.account_name, company_id: model.company_id, is_delete: 0 }
                    : { account_name: model.account_name, company_id: model.company_id, is_delete: 0 }

                // 1 account = 1 secret           
                const secretTaggedCondition = model.id ?
                    { id: Not(model.id), cloud_secret_id: model.cloud_secret_id, is_delete: 0 }
                    : { cloud_secret_id: model.cloud_secret_id, is_delete: 0 }

                const [accountNameExist, secretTagged] = await Promise.all([
                    this.entity.findOneBy(whereCondition),
                    this.entity.findOneBy(secretTaggedCondition)
                ])

                if (accountNameExist) reject('E10024');
                if (secretTagged) reject('E10031')
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-------CloudAccountService prepareQuery-------', error);
                return Promise.reject(error);
            }

        });
    }

    override transformModel(model: CloudAccountModel): CloudAccountModel {
        model.member_id = model.decryptToken.member_id
        return model;
    }

    override createPostProcess(result: CloudAccountModel, model: CloudAccountModel, files: any): Promise<CloudAccountModel> {
        return new Promise(async (resolve, reject) => {
            try {
                await CloudSecretsEntity.update({ id: result.cloud_secret_id }, { status: true })
                resolve(result);
            } catch (error) {
                console.log('----CloudAccountService.createPostProcess----',);
                reject(error)
            }
        });
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            if (!param.company_id) {
                return Promise.reject('E10020');
            }

            let skip = null;
            if (param.pageNumber && param.pageNumber > 0 && param.pageSize) {
                skip = (param.pageNumber - 1) * param.pageSize;
            }

            const search = param.filter?.search ?? '';

            const qb = await this.entity
                .createQueryBuilder('cloudAccount')
                .select([
                    'cloudAccount.id AS id',
                    'cloudAccount.account_name AS account_name',
                    'cloudAccount.cloud_provider_id AS cloud_provider_id',
                    'cloudAccount.cloud_region_id AS cloud_region_id',
                    'cloudAccount.cloud_secret_id AS cloud_secret_id',
                    'cloudAccount.company_id AS company_id',
                    'cloudAccount.member_id AS member_id',
                    'cloudAccount.status AS status',
                    'cloudAccount.created_at AS created_at',
                    'cloudAccount.ownership AS ownership',
                    'cloudProvider.name AS cloud_provider_name',
                    'cloudProvider.cloud_provider_image AS cloud_provider_image',
                    'member.full_name AS member_name',
                    'cloudRegion.name AS cloud_region_name',
                    'cloudSecret.name AS cloud_secret_name',
                    'cm.country_name AS country_name',
                    'cm.country_flag_image AS country_flag_image',
                    'member.profile_picture AS profile_picture'
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'cloudAccount.cloud_provider_id = cloudProvider.id')
                .innerJoin(MembersEntity, 'member', 'cloudAccount.member_id = member.id')
                .innerJoin(CloudRegionEntity, 'cloudRegion', 'cloudAccount.cloud_region_id = cloudRegion.id')
                .leftJoin(CountryMasterEntity, 'cm', 'cm.id = cloudRegion.country_id AND cm.is_delete = 0')
                .innerJoin(CloudSecretsEntity, 'cloudSecret', 'cloudAccount.cloud_secret_id = cloudSecret.id')
                .where('cloudAccount.is_delete = 0')
                // .andWhere('(cloudAccount.company_id = :company_id OR cloudAccount.is_default = true)', { company_id: param.company_id })
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('member.is_delete = 0')
                .andWhere('cloudRegion.is_delete = 0')
                .andWhere('cloudSecret.is_delete = 0');


            if (search) {
                qb.andWhere('LOWER(cloudAccount.account_name) LIKE :search', {
                    search: `%${search.toLowerCase()}%`,
                });
            }

            if (param.module_name) {
                qb.andWhere('cloudAccount.is_default = true')
            } else {
                qb.andWhere('(cloudAccount.company_id = :company_id OR cloudAccount.is_default = true)', { company_id: param.company_id })
            }

            const totalRecords = await qb.getCount();

            if (param.pageSize && skip != null) {
                qb.offset(skip).limit(param.pageSize);
            }

            const record = await qb.orderBy('cloudAccount.created_at', 'DESC').getRawMany();

            let result = []

            if (record.length > 0) {
                for (const rec of record) {
                    if (rec.profile_picture) {
                        const profilePic = rec.profile_picture;
                        if (!profilePic || profilePic.trim() === "") {
                            rec.profile_picture_url = null;
                        }
                        else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                            rec.profile_picture_url = profilePic;
                        }
                        else {
                            try {
                                const signedUrl = await this.generateSignedUrl(
                                    "members",
                                    rec.member_id,
                                    profilePic
                                );
                                rec.profile_picture_url = signedUrl;
                            } catch {
                                rec.profile_picture_url = null;
                            }
                        }
                    }
                }
                result = await Promise.all(
                    record.map(async (r) => ({
                        ...r,
                        hashId: CryptoJS.MD5(r.id).toString(),
                        signedURL_cloud_provider_image: r.cloud_provider_image
                            ? await this.generateSignedUrl(
                                'cloudProviderMedia',
                                r.cloud_provider_id,
                                r.cloud_provider_image
                            )
                            : '',
                        total_cluster: 0,
                        profile_picture_url: r.profile_picture_url
                    }))
                );
            }

            return Promise.resolve({
                data: result,
                totalRecords: totalRecords,
            });
            // return Promise.resolve(result);
        } catch (error) {
            console.log('-------CloudAccountService prepareQuery-------', error);
            return Promise.reject(error);
        }
    }

    async prepareQueryById(param: Pagination): Promise<any> {
        try {
            if (!param.id) {
                return Promise.reject('E10006');
            }

            const record = await this.entity
                .createQueryBuilder('cloudAccount')
                .select([
                    'cloudAccount.id AS id',
                    'cloudAccount.account_name AS account_name',
                    'cloudAccount.cloud_provider_id AS cloud_provider_id',
                    'cloudAccount.cloud_region_id AS cloud_region_id',
                    'cloudAccount.cloud_secret_id AS cloud_secret_id',
                    'cloudAccount.company_id AS company_id',
                    'cloudAccount.member_id AS member_id',
                    'cloudAccount.status AS status',
                    'cloudAccount.created_at AS created_at',
                    'cloudAccount.ownership AS ownership',
                    'cloudProvider.name AS cloud_provider_name',
                    'member.full_name AS member_name',
                    'cloudRegion.name AS cloud_region_name',
                    'cloudSecret.name AS cloud_secret_name',
                    'secretmember.full_name AS secret_owner_name',
                    'cloudProvider.cloud_provider_image AS cloud_provider_image',
                    'cm.country_name AS country_name',
                    'cm.country_flag_image AS country_flag_image'
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'cloudAccount.cloud_provider_id = cloudProvider.id')
                .innerJoin(MembersEntity, 'member', 'cloudAccount.member_id = member.id')
                .innerJoin(CloudRegionEntity, 'cloudRegion', 'cloudAccount.cloud_region_id = cloudRegion.id')
                .leftJoin(CountryMasterEntity, 'cm', 'cm.id = cloudRegion.country_id AND cm.is_delete = 0')
                .innerJoin(CloudSecretsEntity, 'cloudSecret', 'cloudAccount.cloud_secret_id = cloudSecret.id')
                .innerJoin(MembersEntity, 'secretmember', 'cloudSecret.member_id = secretmember.id')
                .where('cloudAccount.is_delete = 0')
                .andWhere('cloudAccount.id = :id', { id: param.id })
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('member.is_delete = 0')
                .andWhere('cloudRegion.is_delete = 0')
                .andWhere('cloudSecret.is_delete = 0')
                .orderBy('cloudAccount.created_at', 'ASC')
                .getRawOne();

            if (!record) {
                return Promise.reject('E10001');
            }

            return Promise.resolve(record);
        } catch (error) {
            console.log('-----CloudAccountService prepareQueryById-----', error);
            return Promise.reject(error)
        }
    }

    override postProcessGetById(result: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result) {
                    result.signedURL_cloud_provider_image = result.cloud_provider_image
                        ? await this.generateSignedUrl('cloudProviderMedia', result.cloud_provider_id, result.cloud_provider_image)
                        : ''
                    result.hashId = CryptoJS.MD5(result.id).toString()

                }
                resolve(result);
            } catch (error) {
                console.log('-----CloudAccountService postProcessGetById-----', error);
                return Promise.reject(error)
            }

        });
    }

}

export default CloudAccountService;
