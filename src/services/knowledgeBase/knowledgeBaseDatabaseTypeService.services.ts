import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { KnowledgeBaseDatabaseTypeEntity } from '../../entities/knowledgeBaseDatabaseTypeEntity';
import { KnowledgeBaseDatabaseTypeModel } from '../../database/repository/databaseType/knowledgeBaseDatabaseType.model';
import { KnowledgeBaseDatabaseTypeDto } from '../../database/repository/databaseType/knowledgeBaseDatabaseType.dto';
import { Pagination } from '../../core/InferParams';
import { MetaModel } from '../../core/MetaModel';

class KnowledgeBaseDatabaseTypeService extends BaseServices {
    constructor(
        entity: any = KnowledgeBaseDatabaseTypeEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): KnowledgeBaseDatabaseTypeModel {
        return new KnowledgeBaseDatabaseTypeModel();
    }

    getDTO(): any {
        return KnowledgeBaseDatabaseTypeDto;
    }

    getModuleName(): string {
        return 'Database Type';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('database_type', 'icon', [
            {
                fileKey: "icon",
                allowedSize: 1024 * 1024 * 5,
                require: "false",
                allowedExtensions: [
                    "image/png",
                    "image/jpg",
                    "image/jpeg",
                    "image/webp",
                    "image/svg+xml",
                ],
                colName: "icon",
            },
        ]);
    }

    override async transformFileData(model: KnowledgeBaseDatabaseTypeModel, files: any): Promise<any> {
        try {
            let fileData = null;
            if (files && files.length > 0) {
                fileData = {
                    ...model,
                    icon: files[0].icon
                };
            } else {
                fileData = {
                    ...model,
                    files
                };
            }

            return Promise.resolve(fileData);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result && result.length > 0) {
                    for (const res of result) {
                        res.icon = res.icon
                            ? await this.generateSignedUrl(this.getMetaModel()?.modelName, res.id, res.icon)
                            : '';
                    }
                }
                resolve(result);
            } catch (error) {
                console.log('-------KnowledgeBaseDatabaseTypeService postProcessAfterGetData--', error);
                reject(error);
            }
        });
    }

    async postProcessGetById(result: any): Promise<any> {
        if (!result) {
            return Promise.reject('E10047');
        }
        try {
            const icon = result.icon;
            if (icon && icon.trim() !== "" && !icon.startsWith("http://") && !icon.startsWith("https://")) {
                try {
                    const signedUrl = await this.generateSignedUrl(
                        "database_type",
                        result.id,
                        icon
                    );
                    result.icon_url = signedUrl;
                    result.icon = signedUrl;
                } catch {
                    result.icon_url = null;
                    result.icon = null;
                }
            } else {
                result.icon_url = icon || null;
                result.icon = icon || null;
            }
        } catch (error) {
            return Promise.reject(error);
        }
        return result;
    }

    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            const query = this.entity
                .createQueryBuilder('dt')
                .select([
                    'dt.id as id',
                    'dt.name as name',
                    'dt.icon as icon',
                    'dt.status as status',
                    'dt.created_at as created_at',
                    'dt.modified_at as modified_at',
                ]);

            if (param.is_delete !== undefined) {
                query.andWhere('dt.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                query.andWhere('dt.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                query.andWhere(
                    '(LOWER(dt.name) LIKE :search)',
                    { search: searchText }
                );
            }

            query.orderBy('dt.id', 'ASC');

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                query.offset(offset).limit(param.pageSize);
            }

            const records = await query.getRawMany();

            for (const record of records) {
                if (record.icon && record.icon.trim() !== "" && !record.icon.startsWith("http://") && !record.icon.startsWith("https://")) {
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "database_type",
                            record.id,
                            record.icon
                        );
                        record.icon_url = signedUrl;
                        record.icon = signedUrl;
                    } catch {
                        record.icon_url = null;
                        record.icon = null;
                    }
                } else {
                    record.icon_url = record.icon || null;
                    record.icon = record.icon || null;
                }
            }

            const countQuery = this.entity.createQueryBuilder('dt');

            if (param.is_delete !== undefined) {
                countQuery.andWhere('dt.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                countQuery.andWhere('dt.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                countQuery.andWhere(
                    '(LOWER(dt.name) LIKE :search)',
                    { search: searchText }
                );
            }

            const total = await countQuery.getCount();

            return Promise.resolve({
                data: records,
                pagination: { total, pageSize: param.pageSize, pageNumber: param.pageNumber },
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

export default KnowledgeBaseDatabaseTypeService;
