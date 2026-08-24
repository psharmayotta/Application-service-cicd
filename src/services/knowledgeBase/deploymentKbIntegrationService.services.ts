import { DeploymentKbIntegrationEntity } from '../../entities/deploymentKbIntegrationEntity';
import { DeploymentKbIntegrationModel } from '../../database/repository/deploymentKbIntegration/deploymentKbIntegration.model';
import { DeploymentKbIntegrationDto } from '../../database/repository/deploymentKbIntegration/deploymentKbIntegration.dto';
import { BaseServices } from '../baseService.services';
import { AwsService } from '../../core/AwsService';
import { KnowledgeBaseEntity } from '../../entities/knowledgeBaseEntity';
import { InfraAllocationEntity } from '../../entities/infraAllocationEntity';
import { MembersEntity } from '../../entities/membersEntity';
import { ModelEntity } from '../../entities/modelEntity';
import { ModelTrainingEntity } from '../../entities/modelTrainingEntity';
import { InfraModuleEntity } from '../../entities/infraModuleEntity';
import { DeploymentType } from '../../config';
import DeploymentService from '../deployments/deploymentService.services';
import AuditLogService from '../auditLog/auditLogService.services';

class DeploymentKbIntegrationService extends BaseServices {
    constructor(
        entity: any = DeploymentKbIntegrationEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): DeploymentKbIntegrationModel {
        return new DeploymentKbIntegrationModel();
    }

    getDTO(): any {
        return DeploymentKbIntegrationDto;
    }

    getModuleName(): string {
        return 'Knowledge Base';
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const query = this.entity.createQueryBuilder('integration')
                .select([
                    'integration.id as id',
                    'integration.knowledge_base_id as knowledge_base_id',
                    'integration.deployment_id as deployment_id',
                    'integration.is_active as is_active',
                    'ia.deployment_name as deployment_name',
                    'ia.created_at as created_at',
                    'ia.user_id as user_id',
                    'COALESCE(m.name, bmt.name) as base_model_name',
                    'mem.full_name as creator_name',
                    'mem.profile_picture as creator_profile_picture'
                ])
                .leftJoin(InfraAllocationEntity, 'ia', 'ia.id = integration.deployment_id')
                .leftJoin(MembersEntity, 'mem', 'mem.id = ia.user_id')
                .leftJoin(InfraModuleEntity, 'ia_mod', 'ia_mod.id = ia.module_type_id')
                .leftJoin(ModelEntity, 'm', 'm.id = ia.module_id AND ia_mod.name != :trainingType', { trainingType: DeploymentType.TRAINING })
                .leftJoin(ModelTrainingEntity, 'mt', 'mt.id = ia.module_id AND ia_mod.name = :trainingType', { trainingType: DeploymentType.TRAINING })
                .leftJoin(ModelEntity, 'bmt', 'bmt.id = mt.model_id')
                .where('integration.is_delete = 0')
                .andWhere('integration.is_active = true');

            if (param.deployment_id) {
                query.andWhere('integration.deployment_id = :deploymentId', { deploymentId: param.deployment_id });
            }

            if (param.knowledge_base_id) {
                query.andWhere('integration.knowledge_base_id = :kbId', { kbId: param.knowledge_base_id });
            }

            const data = await query.getRawMany();

            for (const item of data) {
                if (item.creator_profile_picture) {
                    if (
                        item.creator_profile_picture.startsWith("http://") ||
                        item.creator_profile_picture.startsWith("https://")
                    ) {
                        // It's already an absolute URL (e.g., from OAuth), leave it unchanged
                    } else {
                        try {
                            item.creator_profile_picture = await this.generateSignedUrl('members', item.user_id, item.creator_profile_picture);
                        } catch {
                            item.creator_profile_picture = null;
                        }
                    }
                }

                if (item.deployment_id) {
                    try {
                        const deploymentService = new DeploymentService();
                        const deploymentDetails = await deploymentService.prepareQueryById({ id: item.deployment_id, decryptToken: param.decryptToken } as any);
                        if (deploymentDetails) {
                            item.api_details = deploymentDetails.api_details || [];
                            item.deployment_token = deploymentDetails.deployment_token || null;
                            item.model_provider_image = deploymentDetails.model_provider_image || null;
                            item.playground_config = deploymentDetails.playground_config || null;
                        }
                    } catch (error) {
                        console.error('Error fetching api details for deployment', error);
                    }
                }
            }

            return { data, total: data.length };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    public async deintegrate(id: number): Promise<any> {
        try {
            const record = await this.entity.findOneBy({ id: id, is_delete: 0 });
            if (!record) return Promise.reject("E10021");

            record.is_active = false;
            const updated = await this.entity.save(record);

            // Log deintegration
            await AuditLogService.log({
                company_id: record.company_id,
                member_id: null, // Member ID not passed in deintegrate directly, fallback to null or get from somewhere
                module: this.getModuleName(),
                action: 'DELETE',
                entity_type: 'DeploymentKbIntegrationEntity',
                entity_id: record.id,
                entity_name: `KB Integration-${record.id}`,
                description: `De-integrated Knowledge Base ${record.knowledge_base_id} from Deployment ${record.deployment_id}`,
                ip_address: '',
            });

            return updated;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override async createPostProcess(result: any): Promise<any> {
        let memberId = null;
        if (result && result.decryptToken) {
            memberId = result.decryptToken.member_id;
            delete result.decryptToken;
        }

        await AuditLogService.log({
            company_id: result.company_id,
            member_id: memberId || result.member_id,
            module: this.getModuleName(),
            action: 'CREATE',
            entity_type: 'DeploymentKbIntegrationEntity',
            entity_id: result.id,
            entity_name: `KB Integration-${result.id}`,
            description: `Integrated Knowledge Base ${result.knowledge_base_id} to Deployment ${result.deployment_id}`,
            ip_address: '',
        });

        return result;
    }
}

export default DeploymentKbIntegrationService;
