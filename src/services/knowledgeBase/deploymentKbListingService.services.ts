import { BaseServices } from '../baseService.services';
import { InfraAllocationEntity } from '../../entities/infraAllocationEntity';
import { ModelEntity } from '../../entities/modelEntity';
import { ModelTaskEntity } from '../../entities/modelTaskEntity';
import { InfraModuleEntity } from '../../entities/infraModuleEntity';
import { ModelTrainingEntity } from '../../entities/modelTrainingEntity';
import { DeploymentKbListingModel } from '../../database/repository/knowledgeBase/deploymentKbListing.model';
import { DeploymentKbListingDto } from '../../database/repository/knowledgeBase/deploymentKbListing.dto';
import { Pagination, KnowledgeBaseFilter } from '../../core/InferParams';
import { DeploymentStatus, DeploymentType } from '../../config';
import { PodDetailsEntity } from '../../entities/podDetails';

import { AwsService } from '../../core/AwsService';
import { DeploymentKbIntegrationEntity } from '../../entities/deploymentKbIntegrationEntity';

export class DeploymentKbListingService extends BaseServices {
    constructor(
        entity: any = InfraAllocationEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): DeploymentKbListingModel {
        return new DeploymentKbListingModel();
    }

    getDTO(): any {
        return DeploymentKbListingDto;
    }

    getModuleName(): string {
        return 'Knowledge Base Deployment Listing';
    }

    override async prepareQuery(param: KnowledgeBaseFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!param.company_id) return reject("E10020");

                let skip = 0;
                if (param.pageNumber > 0) {
                    skip = (param.pageNumber - 1) * param.pageSize;
                }

                const qb = this.entity.createQueryBuilder("ia")
                    .select([
                        "ia.id as id",
                        "ia.deployment_name as deployment_name",
                        "ia.slug as slug",
                        "pd.status as status",
                        "ia.model_endpoint as model_endpoint",
                        "COALESCE(m.name, bmt.name) as model_name",
                        "mtk.name as task_name",
                        "CASE WHEN dki.id IS NOT NULL THEN true ELSE false END as is_integrated"
                    ])
                    .leftJoin(InfraModuleEntity, "ia_mod", "ia_mod.id = ia.module_type_id")
                    .leftJoin(ModelEntity, "m", "m.id = ia.module_id AND ia_mod.name != :trainingType", { trainingType: DeploymentType.TRAINING })
                    .leftJoin(ModelTrainingEntity, "mt", "mt.id = ia.module_id AND ia_mod.name = :trainingType", { trainingType: DeploymentType.TRAINING })
                    .leftJoin(ModelEntity, "bmt", "bmt.id = mt.model_id")
                    .leftJoin(ModelTaskEntity, "mtk", "mtk.id = COALESCE(m.model_task_id, bmt.model_task_id)")
                    .leftJoin(DeploymentKbIntegrationEntity, "dki", "dki.deployment_id = ia.id AND dki.knowledge_base_id = :kbId AND dki.is_active = true", { kbId: param.knowledge_base_id })
                    .leftJoin(
                        (subQuery) => {
                            return subQuery
                                .select("pd1.infra_allocation_id", "infra_allocation_id")
                                .addSelect(
                                    "CASE WHEN COUNT(CASE WHEN pd1.status = 'READY' THEN 1 END) > 0 THEN 'READY' ELSE (SELECT pd2.status FROM infra_schema.pod_details pd2 WHERE pd2.infra_allocation_id = pd1.infra_allocation_id AND pd2.is_delete = 0 ORDER BY pd2.id DESC LIMIT 1) END",
                                    "status"
                                )
                                .from(PodDetailsEntity, "pd1")
                                .where("pd1.is_delete = 0")
                                .groupBy("pd1.infra_allocation_id");
                        },
                        "pd",
                        "pd.infra_allocation_id = ia.id"
                    )
                    .where("ia.company_id = :company_id", { company_id: param.company_id })
                    .andWhere("ia.is_delete = 0")
                    .andWhere("pd.status = :status", { status: DeploymentStatus.READY })
                    .andWhere("mtk.name = :taskName", { taskName: 'Text generation' });

                if (param.search_text && param.search_text.trim() !== "") {
                    qb.andWhere("LOWER(ia.deployment_name) LIKE :search", {
                        search: `%${param.search_text.trim().toLowerCase()}%`,
                    });
                }

                qb.orderBy("ia.created_at", "DESC")
                    .offset(skip)
                    .limit(param.pageSize);

                const [data, total] = await Promise.all([
                    qb.getRawMany(),
                    qb.getCount()
                ]);

                resolve({
                    data,
                    pagination: {
                        total,
                        pageSize: param.pageSize,
                        pageNumber: param.pageNumber
                    }
                });
            } catch (error) {
                console.error('Error in DeploymentKbListingService prepareQuery:', error);
                reject(error);
            }
        });
    }
}

