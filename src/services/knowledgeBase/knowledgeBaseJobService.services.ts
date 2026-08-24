import { KnowledgeBaseJobEntity } from '../../entities/knowledgeBaseJobEntity';
import { KnowledgeBaseJobModel } from '../../database/repository/knowledgeBase/knowledgeBaseJob.model';
import { KnowledgeBaseJobDto } from '../../database/repository/knowledgeBase/knowledgeBaseJob.dto';
import { BaseServices } from '../baseService.services';
import { AwsService } from '../../core/AwsService';

export class KnowledgeBaseJobService extends BaseServices {
    constructor(
        entity: any = KnowledgeBaseJobEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): KnowledgeBaseJobModel {
        return new KnowledgeBaseJobModel();
    }

    getDTO(): any {
        return KnowledgeBaseJobDto;
    }

    getModuleName(): string {
        return 'Knowledge Base Job';
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const query = this.entity.createQueryBuilder('kb_job');
            if (param.knowledge_base_id) {
                query.andWhere('kb_job.knowledge_base_id = :kbId', { kbId: param.knowledge_base_id });
            }

            if (param.is_delete !== undefined) {
                query.andWhere('kb_job.is_delete = :isDelete', { isDelete: param.is_delete });
            } else {
                query.andWhere('kb_job.is_delete = 0');
            }

            query.orderBy('kb_job.id', 'DESC');

            if (param.pageNumber && param.pageSize) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                query.offset(offset).limit(param.pageSize);
            }

            const records = await query.getMany();
            const total = await query.getCount();

            return Promise.resolve({
                data: records,
                pagination: { total, pageSize: param.pageSize, pageNumber: param.pageNumber },
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }
}
