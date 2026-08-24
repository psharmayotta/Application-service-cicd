import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { KnowledgeBaseVectorStoreEntity } from '../../entities/knowledgeBaseVectorStoreEntity';
import { KnowledgeBaseVectorStoreModel } from '../../database/repository/knowledgeBaseVectorStore/knowledgeBaseVectorStore.model';
import { KnowledgeBaseVectorStoreDto } from '../../database/repository/knowledgeBaseVectorStore/knowledgeBaseVectorStore.dto';
import { Pagination } from '../../core/InferParams';
import { MetaModel } from '../../core/MetaModel';

class KnowledgeBaseVectorStoreService extends BaseServices {
    constructor(
        entity: any = KnowledgeBaseVectorStoreEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): KnowledgeBaseVectorStoreModel {
        return new KnowledgeBaseVectorStoreModel();
    }

    getDTO(): any {
        return KnowledgeBaseVectorStoreDto;
    }

    getModuleName(): string {
        return 'Vector Store';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('knowledge_base_vector_store', 'icon', [
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

    override async prepareFilter(param: Pagination): Promise<any> {
        const filter = super.prepareFilter(param);
        filter.order = { id: 'ASC' };
        return filter;
    }

    override async transformFileData(model: KnowledgeBaseVectorStoreModel, files: any): Promise<any> {
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
                console.log('-------KnowledgeBaseVectorStoreService postProcessAfterGetData--', error);
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
                        "knowledge_base_vector_store",
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
                .createQueryBuilder('vs')
                .select([
                    'vs.id as id',
                    'vs.name as name',
                    'vs.icon as icon',
                    'vs.coming_soon as coming_soon',
                    'vs.status as status',
                    'vs.created_at as created_at',
                    'vs.modified_at as modified_at',
                ]);

            if (param.is_delete !== undefined) {
                query.andWhere('vs.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                query.andWhere('vs.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                query.andWhere(
                    '(LOWER(vs.name) LIKE :search)',
                    { search: searchText }
                );
            }

            query.orderBy('vs.id', 'ASC');

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                query.offset(offset).limit(param.pageSize);
            }

            const records = await query.getRawMany();

            for (const record of records) {
                if (record.icon && record.icon.trim() !== "" && !record.icon.startsWith("http://") && !record.icon.startsWith("https://")) {
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "knowledge_base_vector_store",
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

            const countQuery = this.entity.createQueryBuilder('vs');

            if (param.is_delete !== undefined) {
                countQuery.andWhere('vs.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                countQuery.andWhere('vs.is_delete = :isDelete', { isDelete: 0 });
            }

            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                countQuery.andWhere(
                    '(LOWER(vs.name) LIKE :search)',
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

export default KnowledgeBaseVectorStoreService;
