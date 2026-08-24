import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { CloudSecretsEntity } from '../../entities/cloudSecretsEntity';
import { CloudSecretsModel } from '../../database/repository/cloudSecrets/cloudSecrets.model';
import { CloudSecretsDto } from '../../database/repository/cloudSecrets/cloudSecrets.dto';
import { Pagination } from '../../core/InferParams';
import { CloudProviderEntity } from '../../entities/cloudProviderEntity';
import { MembersEntity } from '../../entities/membersEntity';
import CryptoJS from 'crypto-js';
import { FileObject } from '../../core/FileModel';
import AuditLogService from '../auditLog/auditLogService.services';

class CloudSecretsService extends BaseServices {
    constructor(entity: any = CloudSecretsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): CloudSecretsModel {
        return new CloudSecretsModel();
    }

    getDTO() {
        return CloudSecretsDto;
    }

    getModuleName(): string {
        return 'Secret';
    }

    override createPreProcess(model: CloudSecretsModel, files: FileObject[] | null): Promise<CloudSecretsModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                model.member_id = model.decryptToken.member_id
                const checkSecret = await this.entity.findOne({ where: { name: model.name, company_id: model.company_id, is_delete: 0 } })
                if (checkSecret && model.id === undefined) {
                    return reject('E10059');
                }
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-------CloudSecretsService createPreProcess error---------', error);
                reject(error)
            }
        });
    }

    override async createPostProcess(result: CloudSecretsModel, model: CloudSecretsModel, files: any): Promise<CloudSecretsModel> {
        try {
            const action = model.id ? 'UPDATE' : 'CREATE';
            const actionText = model.id ? 'updated' : 'created';
            
            await AuditLogService.log({
                company_id: Number(result.company_id),
                member_id: model.decryptToken?.member_id || result.member_id,
                module: this.getModuleName(),
                action: action,
                entity_type: 'CloudSecretsEntity',
                entity_id: result.id,
                entity_name: result.name,
                description: `Cloud Secret '${result.name}' was ${actionText}`,
                ip_address: '',
            });
            return result;
        } catch (error) {
            console.error('-------CloudSecretsService createPostProcess error---------', error);
            throw error;
        }
    }

    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            if (!param.company_id) {
                return Promise.reject('E10020');
            }

            let skip = null;
            if (param.pageNumber && param.pageNumber > 0 && param.pageSize) {
                skip = (param.pageNumber - 1) * param.pageSize;
            }

            const search = param.filter?.search ?? '';

            // build base query (no offset/limit yet)
            const qb = this.entity
                .createQueryBuilder('secret')
                .select([
                    'secret.id AS id',
                    'secret.name AS name',
                    'secret.c_provider_id AS c_provider_id',
                    'secret.cloud_service_id AS cloud_service_id',
                    'secret.secrets AS secrets',
                    'secret.company_id AS company_id',
                    'secret.member_id AS member_id',
                    'secret.status AS status',
                    'secret.created_at AS created_at',
                    'secret.last_used_at AS last_used_at',
                    'secret.last_used_by_module AS last_used_by_module',
                    'cloudProvider.name AS cloud_provider_name',
                    'cloudProvider.cloud_provider_image AS cloud_provider_image',
                    'member.full_name AS member_name',
                    'member.profile_picture AS profile_picture',
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'secret.c_provider_id = cloudProvider.id')
                .innerJoin(MembersEntity, 'member', 'secret.member_id = member.id')
                .where('secret.is_delete = 0')
                .andWhere('secret.company_id = :company_id', { company_id: param.company_id })
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('member.is_delete = 0');

            if (search) {
                qb.andWhere('LOWER(secret.name) LIKE :search', {
                    search: `%${search.toLowerCase()}%`,
                });
            }

            // Filter by secret type (cloud provider id)
            if (param.filter?.secret_type) {
                qb.andWhere('secret.c_provider_id = :secretType', {
                    secretType: param.filter.secret_type,
                });
            }

            // Filter by usage status: 'used' or 'unused'
            if (param.filter?.usage_status) {
                const usageStatus = param.filter.usage_status.toLowerCase();
                if (usageStatus === 'used') {
                    qb.andWhere('secret.last_used_at IS NOT NULL');
                } else if (usageStatus === 'unused') {
                    qb.andWhere('secret.last_used_at IS NULL');
                }
            }

            const totalRecords = await qb.getCount();

            if (param.pageSize && skip != null) {
                qb.offset(skip).limit(param.pageSize);
            }

            const record: any[] = await qb.orderBy('secret.created_at', 'DESC').getRawMany();

            if (record && record.length > 0) {
                for (const rec of record) {
                    rec.hashId = CryptoJS.MD5(rec.id).toString()
                    rec.cloud_provider_image_url = rec.cloud_provider_image
                        ? await this.generateSignedUrl('cloudProviderMedia', rec.c_provider_id, rec.cloud_provider_image)
                        : ''

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

            return Promise.resolve({
                data: record,
                totalRecords: totalRecords,
            });
        } catch (error) {
            console.log('-------CloudSecretsService prepareQuery-------', error);
            return Promise.reject(error);
        }
    }


    override async prepareQueryById(param: Pagination): Promise<any> {
        try {
            if (!param.id) {
                return Promise.reject('E10006');
            }

            const record = await this.entity
                .createQueryBuilder('secret')
                .select([
                    'secret.id AS id',
                    'secret.name AS name',
                    'secret.c_provider_id AS c_provider_id',
                    'secret.cloud_service_id AS cloud_service_id',
                    'secret.secrets AS secrets',
                    'secret.company_id AS company_id',
                    'secret.member_id AS member_id',
                    'secret.status AS status',
                    'secret.created_at AS created_at',
                    'secret.last_used_at AS last_used_at',
                    'secret.last_used_by_module AS last_used_by_module',
                    'cloudProvider.name AS cloud_provider_name',
                    'cloudProvider.cloud_provider_image AS cloud_provider_image',
                    'cloudProvider.secret_template AS secret_template',
                    'member.full_name AS member_name',
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'secret.c_provider_id = cloudProvider.id')
                .innerJoin(MembersEntity, 'member', 'secret.member_id = member.id')
                .where('secret.is_delete = 0')
                .andWhere('secret.id = :id', { id: param.id })
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('member.is_delete = 0')
                .getRawOne();

            if (!record) {
                return Promise.reject('E10001');
            }

            if (record) {
                record.hashId = CryptoJS.MD5(record.id).toString()
                record.cloud_provider_image_url = record.cloud_provider_image
                    ? await this.generateSignedUrl('cloudProviderMedia', record.c_provider_id, record.cloud_provider_image)
                    : ''
            }

            return Promise.resolve(record);
        } catch (error) {
            console.log('-------CloudSecretsService prepareQueryById-------', error);
            return Promise.reject(error);
        }
    }

    static async updateSecretLastUsed(secretId: number, moduleName: string): Promise<void> {
        try {
            await CloudSecretsEntity.update(
                { id: secretId },
                { last_used_at: new Date(), last_used_by_module: moduleName }
            );
        } catch (error) {
            console.log('-------CloudSecretsService updateSecretLastUsed error---------', error);
            // Non-blocking — don't reject the parent operation
        }
    }

    public override updateDeleteFlagData = async (param: any): Promise<boolean> => {
        try {
            const whereid = await this.updateDeleteFlagPreProcess(param);
            if (whereid === null) {
                return false;
            }
            const records = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
            if (records && records.length > 0) {
                await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();

                for (const record of records) {
                    await AuditLogService.log({
                        company_id: record.company_id,
                        member_id: param.decryptToken?.member_id || record.member_id,
                        module: this.getModuleName(),
                        action: 'DELETE',
                        entity_type: 'CloudSecretsEntity',
                        entity_id: record.id,
                        entity_name: record.name,
                        description: `Cloud Secret '${record.name}' was deleted`,
                        ip_address: param.ip_address || '',
                    });
                }
                return true;
            } else {
                return false;
            }
        } catch (e) {
            throw e;
        }
    };
}

export default CloudSecretsService;
