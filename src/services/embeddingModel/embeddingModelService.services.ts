import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { EmbeddingModelEntity } from '../../entities/embeddingModelEntity';
import { EmbeddingModelModel } from '../../database/repository/embeddingModel/embeddingModel.model';
import { EmbeddingModelDto } from '../../database/repository/embeddingModel/embeddingModel.dto';
import { Pagination } from '../../core/InferParams';
import { MetaModel } from '../../core/MetaModel';

class EmbeddingModelService extends BaseServices {
    constructor(
        entity: any = EmbeddingModelEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): EmbeddingModelModel {
        return new EmbeddingModelModel();
    }

    getDTO(): any {
        return EmbeddingModelDto;
    }

    getModuleName(): string {
        return 'Embedding Model';
    }

    getMetaModel(): MetaModel {
        return new MetaModel('embedding_models', 'icon', [
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

    override async transformFileData(model: EmbeddingModelModel, files: any): Promise<any> {
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

    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            const records = await this.entity.find({
                where: { is_delete: 0, status: true },
                order: { name: 'ASC' },
            });

            for (const record of records) {
                if (record.icon && record.icon.trim() !== "" && !record.icon.startsWith("http://") && !record.icon.startsWith("https://")) {
                    try {
                        const signedUrl = await this.generateSignedUrl('embedding_models', record.id, record.icon);
                        record.icon = signedUrl;
                    } catch {
                        record.icon = null;
                    }
                }
            }

            return Promise.resolve({
                data: records,
                pagination: {
                    total: records.length,
                    pageSize: records.length,
                    pageNumber: 1,
                },
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: Pagination): Promise<any> {
        try {
            const record = await this.entity.findOneBy({ id: param.id, is_delete: 0 });
            if (!record) return Promise.reject('E10021');

            if (record.icon && record.icon.trim() !== "" && !record.icon.startsWith("http://") && !record.icon.startsWith("https://")) {
                try {
                    const signedUrl = await this.generateSignedUrl('embedding_models', record.id, record.icon);
                    record.icon = signedUrl;
                } catch {
                    record.icon = null;
                }
            }

            return record;
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

export default EmbeddingModelService;
