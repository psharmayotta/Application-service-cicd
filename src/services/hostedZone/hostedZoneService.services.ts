import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { CloudFilter, Pagination } from '../../core/InferParams';
import { FileObject } from '../../core/FileModel';
import { Not } from 'typeorm';
import { MembersEntity } from '../../entities/membersEntity';
import { HostedZoneEntity } from '../../entities/hostedZoneEntity';
import { HostedZoneModel } from '../../database/repository/hostedZone/hostedZone.model';
import { HostedZoneDto } from '../../database/repository/hostedZone/hostedZone.dto';
import { CloudAccountEntity } from '../../entities/cloudAccountEntity';
import CryptoJS from 'crypto-js';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { CLOUDFRONTBASEURL } from '../../config';

class HostedZoneService extends BaseServices {
    constructor(entity: any = HostedZoneEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): HostedZoneModel {
        return new HostedZoneModel();
    }

    getDTO(): any {
        return HostedZoneDto;
    }

    getModuleName(): string {
        return 'Cloud Zone';
    }

    override createPreProcess(model: HostedZoneModel, files: FileObject[] | null): Promise<HostedZoneModel> {
        return new Promise<HostedZoneModel>(async (resolve, reject) => {
            try {
                const checkNameExist = await this.entity.findOneBy({ hosted_zone_name: model.hosted_zone_name, company_id: model.company_id, is_delete: 0 })
                if (checkNameExist && model.id === undefined) {
                    return reject('E10060');
                }
                const domainWhereCondition = model.id ?
                    { id: Not(model.id), domain: model.domain, is_delete: 0 }
                    : { domain: model.domain, is_delete: 0 }

                const subDomainWhereCondition = model.id ?
                    { id: Not(model.id), sub_domain: model.sub_domain, is_delete: 0 }
                    : { domain: model.sub_domain, is_delete: 0 }

                const [domainNameExist, subDomainNameExist] = await Promise.all([
                    this.entity.findOneBy(domainWhereCondition),
                    this.entity.findOneBy(subDomainWhereCondition)
                ])

                if (domainNameExist) reject('E10025');
                if (subDomainNameExist) reject('E10026')
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-------HostedZoneService createPreProcess-------', error);
                reject(error);
            }
        });
    }

    override transformModel(model: HostedZoneModel): HostedZoneModel {
        model.member_id = model.decryptToken.member_id;
        model.full_domain = `${model.sub_domain}.${model.domain}`;
        return model;
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {
            if (!param.company_id) {
                return Promise.reject('E10020');
            }

            const search = param.filter?.search

            let skip = null;
            if (param.pageNumber && param.pageNumber > 0 && param.pageSize) {
                skip = (param.pageNumber - 1) * param.pageSize;
            }

            const qb = await this.entity
                .createQueryBuilder('hostedZone')
                .select([
                    'hostedZone.id AS id',
                    'hostedZone.hosted_zone_name AS hosted_zone_name',
                    'hostedZone.domain as domain',
                    'hostedZone.sub_domain as sub_domain',
                    'hostedZone.full_domain as full_domain',
                    'hostedZone.zone_id as zone_id',
                    'hostedZone.cloud_account_id AS cloud_account_id',
                    'hostedZone.company_id AS company_id',
                    'hostedZone.member_id AS member_id',
                    'hostedZone.status AS status',
                    'hostedZone.created_at AS created_at',
                    'cloudAccount.account_name AS account_name',
                    'member.full_name AS hosted_owner_name',
                    'member.profile_picture AS profile_picture',
                ])
                .innerJoin(CloudAccountEntity, 'cloudAccount', 'hostedZone.cloud_account_id = cloudAccount.id')
                .innerJoin(MembersEntity, 'member', 'hostedZone.member_id = member.id')
                .where('hostedZone.is_delete = 0')
                .andWhere('hostedZone.company_id = :company_id', { company_id: param.company_id })
                .andWhere('cloudAccount.is_delete = 0')
                .andWhere('member.is_delete = 0');

            if (search) {
                qb.andWhere('LOWER(hostedZone.hosted_zone_name) LIKE :search', {
                    search: `%${search.toLowerCase()}%`,
                });
            }

            if (param.cloud_account_id) {
                qb.andWhere('hostedZone.cloud_account_id = :cloud_account_id', { cloud_account_id: param.cloud_account_id })
            }

            const totalRecords = await qb.getCount();

            if (param.pageSize && skip != null) {
                qb.offset(skip).limit(param.pageSize);
            }

            const record = await qb.orderBy('hostedZone.created_at', 'DESC').getRawMany();
            if (record && record.length > 0) {
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
            }
            const result = record.map(r => ({
                ...r,
                hashId: CryptoJS.MD5(r.id).toString(),
                cluster_counts: 0
            }));

            return Promise.resolve({
                data: result,
                totalRecords: totalRecords,
            });

            // return Promise.resolve(result);
        } catch (error) {
            console.log('-------HostedZoneService prepareQuery-------', error);
            return Promise.reject(error);
        }
    }

    async prepareQueryById(param: Pagination): Promise<any> {
        try {
            if (!param.id) {
                return Promise.reject('E10006');
            }

            const record = await this.entity
                .createQueryBuilder('hostedZone')
                .select([
                    'hostedZone.id AS id',
                    'hostedZone.hosted_zone_name AS hosted_zone_name',
                    'hostedZone.domain as domain',
                    'hostedZone.sub_domain as sub_domain',
                    'hostedZone.full_domain as full_domain',
                    'hostedZone.zone_id as zone_id',
                    'hostedZone.cloud_account_id AS cloud_account_id',
                    'hostedZone.company_id AS company_id',
                    'hostedZone.member_id AS member_id',
                    'hostedZone.status AS status',
                    'hostedZone.created_at AS created_at',
                    'cloudAccount.account_name AS account_name',
                    'member.full_name AS hosted_owner_name',
                    'cloudAccount.status AS account_status',
                    'cloudAccount.created_at AS account_created_at',
                    'cloudAccount.ownership AS account_ownership',
                    'accountMember.full_name AS account_member_name',
                    'cloudProvider.cloud_provider_image AS cloud_provider_image',
                    'cloudProvider.name AS cloud_provider_name',
                ])
                .innerJoin(CloudAccountEntity, 'cloudAccount', 'hostedZone.cloud_account_id = cloudAccount.id')
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'cloudAccount.cloud_provider_id = cloudProvider.id')
                .innerJoin(MembersEntity, 'member', 'hostedZone.member_id = member.id')
                .innerJoin(MembersEntity, 'accountMember', 'cloudAccount.member_id = accountMember.id')
                .where('hostedZone.is_delete = 0')
                .andWhere('hostedZone.id = :id', { id: param.id })
                .andWhere('cloudAccount.is_delete = 0')
                .andWhere('member.is_delete = 0')
                .getRawOne();

            if (!record) {
                return Promise.reject('E10001');
            }

            record.hashId = CryptoJS.MD5(record.id).toString()
            record.cloud_provider_image_url = record.cloud_provider_image ? `${CLOUDFRONTBASEURL}${record.cloud_provider_image}` : '';

            return Promise.resolve(record);
        } catch (error) {
            console.log('-----HostedZoneService prepareQueryById-----', error);
            return Promise.reject(error)
        }
    }

}

export default HostedZoneService;
