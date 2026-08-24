import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { ApiKeyTokenEntity } from "../../entities/apiKeyTokenEntity";
import { APIKeyTokenModel } from "../../database/repository/apiKeyToken/apiKeyToken.model";
import { ApiKeyTokenDto } from "../../database/repository/apiKeyToken/apiKeyToken.dto";
import { FileObject } from "../../core/FileModel";
import { In, MoreThan, Not } from "typeorm";
import { ErrorCodes } from "../../core/ErrorCodes";
import { Pagination } from "../../core/InferParams";
import { createjwt } from "../../utils/jwt/jwt";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { v4 as uuidv4 } from "uuid";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { MembersEntity } from "../../entities/membersEntity";
import AuditLogService from "../auditLog/auditLogService.services";

class APIKeyTokenService extends BaseServices {
    constructor(entity: any = ApiKeyTokenEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): APIKeyTokenModel {
        return new APIKeyTokenModel();
    }

    getDTO(): any {
        return ApiKeyTokenDto;
    }

    getModuleName(): string {
        return 'API Key';
    }

    override createPreProcess(model: APIKeyTokenModel, files: FileObject[] | null): Promise<APIKeyTokenModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                if (model.decryptToken.member_id) {
                    const existingKeysCount = await this.entity.count({
                        where: {
                            generatedby_user_id: model.decryptToken.member_id,
                            company_id: model.company_id,
                            status: 1,
                            is_delete: 0
                        }
                    });

                    if (existingKeysCount >= 4) {
                        return reject('E10012');
                    }
                }

                let whereCondition: any = {
                    api_key_name: model.api_key_name,
                    company_id: model.company_id,
                    is_delete: 0,
                };

                if (model.id) {
                    whereCondition.id = Not(model.id);
                }

                const apiKeyNameExist = await this.entity.findOneBy(whereCondition);

                if (apiKeyNameExist) {
                    return reject('E10011');
                }
                model.generated_token = createjwt({
                    member_id: model.decryptToken.member_id,
                    email: model.decryptToken.email,
                    company_id: model.company_id,
                    role_id: 1
                });
                model.generatedby_user_id = model.decryptToken.member_id;
                model.generated_year = new Date().getFullYear().toString();
                model.company_id
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-------APIKeyTokenService createPreProcess error---------', error);
                reject(error)
            }
        });
    }

    // async prepareQuery(param: Pagination): Promise<any> {
    //     const { decryptToken, company_id } = param;
    //     const member_id = decryptToken?.member_id;
    //     const whereCondition: any = {
    //         is_delete: 0,
    //     };
    //     if (member_id) {
    //         whereCondition.generatedby_user_id = member_id;
    //     }
    //     if (company_id) {
    //         whereCondition.company_id = company_id;
    //     }
    //     const records = await this.entity.find({ where: whereCondition, order: { id: 'DESC' } });

    //     const currentTime = new Date();
    //     for (const record of records) {
    //         if (record.expiry_token_time && new Date(record.expiry_token_time) < currentTime) {
    //             record.status = false;
    //             await this.entity.update({ id: record.id }, { status: 0 });
    //         }
    //     }

    //     return records;
    // }

    async prepareQuery(param: Pagination): Promise<any> {
        const { decryptToken, id } = param;
        const member_id = decryptToken?.member_id;

        const whereCondition: any = {
            is_delete: 0,
        };

        if (member_id) {
            whereCondition.generatedby_user_id = member_id;
        }

        if (id) {
            whereCondition.company_id = id;
        }
        const records = await this.entity.find({
            where: whereCondition,
            order: { id: 'DESC' }
        });

        const currentTime = new Date();
        for (const record of records) {
            if (
                record.expiry_token_time &&
                new Date(record.expiry_token_time) < currentTime
            ) {
                record.status = false;
                await this.entity.update(
                    { id: record.id },
                    { status: 0 }
                );
            }
        }

        const generatedByIds = [
            ...new Set(
                records
                    .map(r => r.generatedby_user_id)
                    .filter(Boolean)
            )
        ];

        let membersMap: Record<number, any> = {};

        if (generatedByIds.length > 0) {
            const members = await MembersEntity.find({
                where: {
                    id: In(generatedByIds),
                    is_delete: 0
                }
            });

            for (const m of members) {
                membersMap[m.id] = m;
            }
        }

        for (const record of records) {
            const member = membersMap[record.generatedby_user_id];

            if (!member) {
                record.generated_by_name = null;
                record.generated_by_profile_picture = null;
                record.generated_by_profile_picture_url = null;
                continue;
            }

            record.generated_by_name = member.full_name;
            record.generated_by_profile_picture = member.profile_picture;

            const profilePic = member.profile_picture;

            if (!profilePic || profilePic.trim() === "") {
                record.generated_by_profile_picture_url = null;

            } else if (
                profilePic.startsWith("http://") ||
                profilePic.startsWith("https://")
            ) {
                record.generated_by_profile_picture_url = profilePic;

            } else {
                try {
                    const signedUrl = await this.generateSignedUrl(
                        "members",
                        member.id,
                        profilePic
                    );
                    record.generated_by_profile_picture_url = signedUrl;
                } catch {
                    record.generated_by_profile_picture_url = null;
                }
            }
        }

        return records;
    }


    deletePostProcess(result: InferModel): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            this.entity.update({ id: result.id }, { status: 0 });
            resolve(result);
        })
    }

    override async updateDeleteFlagPostProcess(records: any[], param: any): Promise<void> {
        try {
            for (const record of records) {
                await AuditLogService.log({
                    company_id: record.company_id,
                    member_id: param.decryptToken?.member_id || record.generatedby_user_id,
                    module: this.getModuleName(),
                    action: 'DELETE',
                    entity_type: 'ApiKeyTokenEntity',
                    entity_id: record.id,
                    entity_name: record.api_key_name,
                    description: `API Key '${record.api_key_name}' was deleted`,
                    ip_address: param.ip_address || '',
                });
            }
        } catch (error) {
            console.error('APIKeyTokenService updateDeleteFlagPostProcess error:', error);
        }
    }

    override async createPostProcess(result: APIKeyTokenModel, model: APIKeyTokenModel, files: any): Promise<APIKeyTokenModel> {
        try {
            const isUpdate = model.id !== undefined && model.id !== null && model.id !== 0;
            await AuditLogService.log({
                company_id: result.company_id,
                member_id: result.generatedby_user_id || model.decryptToken?.member_id,
                module: this.getModuleName(),
                action: isUpdate ? 'UPDATE' : 'CREATE',
                entity_type: 'ApiKeyTokenEntity',
                entity_id: result.id,
                entity_name: result.api_key_name,
                description: `API Key '${result.api_key_name}' was ${isUpdate ? 'updated' : 'created'}`,
                ip_address: '',
            });
            return result;
        } catch (error) {
            console.error('-------APIKeyTokenService createPostProcess error---------', error);
            throw error;
        }
    }


    async createInitialApiKeyToken(member_id: number): Promise<any[]> {
        try {
            const now = new Date();
            const email = ''

            const companyListWithMember = await CompanyMemberRolesEntity.find({
                where: { member_id },
            });
            const memberData = await MembersEntity.findOne({
                where: { id: member_id },
            });

            const result: any[] = [];

            for (const company of companyListWithMember) {
                const company_id = company.company_id;

                // check existing active keys
                const activeKeys = await this.entity.find({
                    where: {
                        company_id,
                        generatedby_user_id: member_id,
                        expiry_token_time: MoreThan(now),
                        status: 1,
                    },
                    order: { generated_token_time: "ASC" },
                });

                if (activeKeys.length > 0) {
                    result.push(activeKeys[0]);
                    continue;
                }

                // create new key
                const generated_token = createjwt({
                    member_id,
                    email: memberData.email,
                    company_id,
                    role_id: company.role_id ?? 1,
                });

                const generatedTime = new Date();
                const expiryTime = new Date();
                expiryTime.setDate(expiryTime.getDate() + 1);
                const entity = this.entity.create({
                    api_key_name: `TOKEN ${generatedTime.getTime()}`,
                    generated_token_time: generatedTime,
                    expiry_token_time: expiryTime,
                    generated_year: generatedTime.getFullYear().toString(),
                    generatedby_user_id: member_id,
                    company_id,
                    generated_token,
                    status: 1,
                    is_playground_key: true,
                });

                const saved = await this.entity.save(entity);
                result.push(saved);

                await AuditLogService.log({
                    company_id: company_id,
                    member_id: member_id,
                    module: this.getModuleName(),
                    action: 'CREATE',
                    entity_type: 'ApiKeyTokenEntity',
                    entity_id: saved.id,
                    entity_name: saved.api_key_name,
                    description: `API Key '${saved.api_key_name}' was created`,
                    ip_address: '',
                });
            }

            return result;
        } catch (error) {
            console.error("Error in createInitialApiKeyToken:", error);
            throw error;
        }
    }

    /**
     * Validates an API key by checking:
     * 1. The token exists in the api_key_token table
     * 2. It is not soft-deleted (is_delete = 0)
     * 3. It is active (status = 1)
     * 4. It has not expired (expiry_token_time > now)
     * 
     * @param apiKey - The raw generated_token string to validate
     * @returns true if valid, false otherwise
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const tokenRecord = await this.entity.findOneBy({
                generated_token: apiKey,
                is_delete: 0,
                status: 1,
            });

            if (!tokenRecord) {
                return false;
            }

            // Check expiry
            if (tokenRecord.expiry_token_time) {
                const now = new Date();
                if (new Date(tokenRecord.expiry_token_time) < now) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('-------APIKeyTokenService validateApiKey error---------', error);
            return false;
        }
    }

}

export default APIKeyTokenService;