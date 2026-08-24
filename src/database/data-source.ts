import { PodDetailsEntity } from './../entities/podDetails';
import { DataSource } from 'typeorm'
import { CompanyEntity } from '../entities/companyEntity';
import { MembersEntity } from '../entities/membersEntity';
import { RolesEntity } from '../entities/rolesEntity';
import { ModulesEntity } from '../entities/modulesEntity';
import { RoleModulePermissionEntity } from '../entities/roleModulePermissionEntity';
import { MemberLoginsEntity } from '../entities/memberLoginsEntity';
import { CompanyRoleMapperEntity } from '../entities/companyRoleMapperEntity';
import { CompanyMemberRolesEntity } from '../entities/companyMemberRolesEntity';
import { ModelEntity } from '../entities/modelEntity';
import { ModelCategoryEntity } from '../entities/modelCategoryEntity';
import { ModelClassEntity } from '../entities/modelClassEntity';
import { ModelGpuMapperEntity } from '../entities/modelGpuMapperEntity';
import { ModelLibarariesEntity } from '../entities/modelLibarariesEntity';
import { ModelLicensesEntity } from '../entities/modelLicensesEntity';
import { ModelProviderEntity } from '../entities/modelProviderEntity';
import { ModelTaskEntity } from '../entities/modelTaskEntity';
import { ModelTypeEntity } from '../entities/modelTypeEntity';
import { SourceEntity } from '../entities/sourceEntity';
import { InferencingEntity } from '../entities/inferenceEntity';
import { QueryLogger } from '../core/QueryLogger';
import { ApiKeyTokenEntity } from '../entities/apiKeyTokenEntity';
import { InviteEntity } from '../entities/inviteEntity';
import { ModelAPIDetailsEntity } from '../entities/modelApiDetailsEntity';
import { CloudSecretsEntity } from '../entities/cloudSecretsEntity';
import { InfraAllocationEntity } from '../entities/infraAllocationEntity';
import { ChatEntity } from '../entities/chatEntity';
import { ChatSessionEntity } from '../entities/chatSessionEntity';
import { CloudProviderEntity } from '../entities/cloudProviderEntity';
import { QuantizationEntity } from '../entities/quantizationEntity';
import { ModelQuantizationMapper } from '../entities/modelQuantizationMapper';
import { CloudAccountEntity } from '../entities/cloudAccountEntity';
import { CloudRegionEntity } from '../entities/cloudRegionEntity';
import { HostedZoneEntity } from '../entities/hostedZoneEntity';
import { HardwareSpecsEntity } from '../entities/hardwareSpecsEntity';
import { InfraNodesEntity } from '../entities/infraNodesEntity';
import { InfraSpecsMapperEntity } from '../entities/infraSpecsMapperEntity';
import { CloudZoneEntity } from '../entities/cloudZoneEntity';
import { CloudServicesEntity } from '../entities/cloudServiceEntity';
import { TimezoneEntity } from '../entities/timezoneEntity';
import { InfraHardwareModuleMapperEntity } from '../entities/infraHardwareModuleMapperEntity';
import { DataSetEntity } from '../entities/dataSetEntity';
import { ModelTrainingEntity } from '../entities/modelTrainingEntity';
import { ClustersEntity } from '../entities/clusterEntity';
import { InfraModuleEntity } from '../entities/infraModuleEntity';
import { HardwareMasterEntity } from '../entities/hardwareMasterEntity';
import { CountryMasterEntity } from '../entities/countryEntity';
import { AllocationEntity } from '../entities/allocationEntity';
import { HardwareUtilizationEntity } from '../entities/hardwareUtilization';
import { PodLogEntity } from '../entities/podLogEntity';
import { WalletEntity } from '../entities/walletEntity';
import { WalletTransactionEntity } from '../entities/walletTransactionsEntity';
import { WalletRefundEntity } from '../entities/walletRefundsEntity';
import { WalletRechargeEntity } from '../entities/walletRechargesEntity';
import { PaymentTransactionEntity } from '../entities/paymentTransactionsEntity';
import { PricePlanEntity } from '../entities/pricePlanEntity';
import { config } from '../config';
import { DeploymentQuotaEntity } from '../entities/deploymentQuotaEntity';
import { DeploymentQuotaUsageEntity } from '../entities/deploymentQuotaUsageEntity';
import { ReservationEntity } from '../entities/reservationEntity';
import { NotificationEntity } from '../entities/notificationEntity';
import { InfraQueueEntity } from '../entities/infraQueueEntity';
import { ContactUsEntity } from '../entities/contactUsEntity';
import { NodeGroupsEntity } from '../entities/nodeGroupsEntity';
import { NodeGroupMembersEntity } from '../entities/nodeGroupMapperEntity';
import { BenchmarkingEntity } from '../entities/benchmarkingEntity';
import { EvaluationTaskEntity } from '../entities/evaluationTaskEntity';
import { KnowledgeBaseEntity } from '../entities/knowledgeBaseEntity';

import { EmbeddingModelEntity } from '../entities/embeddingModelEntity';
import { KnowledgeBaseSourceEntity } from '../entities/knowledgeBaseSourceEntity';
import { KnowledgeBaseDatabaseTypeEntity } from '../entities/knowledgeBaseDatabaseTypeEntity';
import { KnowledgeBaseVectorStoreEntity } from '../entities/knowledgeBaseVectorStoreEntity';
import { BenchmarkingDatasetEntity } from '../entities/benchmarkingDatasetEntity';
import { DeploymentUsageLedgerEntity } from '../entities/deploymentUsageLedgerEntity';
import { BatchInferenceEntity } from '../entities/batchInferenceEntity';
import { BatchInferenceJobEntity } from '../entities/batchInferenceJobEntity';
import { KnowledgeBaseSourceMappingEntity } from '../entities/knowledgeBaseSourceMappingEntity';
import { DeploymentKbIntegrationEntity } from '../entities/deploymentKbIntegrationEntity';
import { KnowledgeBaseJobEntity } from '../entities/knowledgeBaseJobEntity';
import { TrainingWeightsEntity } from '../entities/trainingWeightsEntity';
import { BudgetControlEntity } from '../entities/budgetControlEntity';
import { BudgetAlertHistoryEntity } from '../entities/budgetAlertHistoryEntity';
import { WebhookConfigEntity } from '../entities/webhookConfigEntity';
import { WebhookEntity } from '../entities/webhookEntity';
import { WebhookIntegratedPlatformEntity } from '../entities/webhookIntegratedPlatformEntity';
import { WebhookPlatformEntity } from '../entities/webhookPlatformEntity';
import { IntegrationEntity } from '../entities/integrationEntity';
import { CompanyIntegrationMapperEntity } from '../entities/companyIntegrationMapperEntity';
import { AuditLogEntity } from '../entities/auditLogEntity';
import { AuditLogModuleEntity } from '../entities/auditLogModuleEntity';
import { AuditLogActionEntity } from '../entities/auditLogActionEntity';
import { NimModelEntity } from '../entities/nimModelEntity';
import { GuardrailsEntity } from '../entities/guardrailsEntity';
import { RbacRolesEntity } from '../entities/rbacRolesEntity';


console.log('-----------process-----------', config);

export const getPostgresConnection = () => {
    const postgresConnection = new DataSource({
        name: 'default',
        type: 'postgres',
        host: config.db.host,
        port: config.db.port,
        username: config.db.username,
        password: config.db.password,
        database: config.db.database,
        entities: [
            WalletEntity,
            WalletTransactionEntity,
            WalletRefundEntity,
            WalletRechargeEntity,
            PaymentTransactionEntity,
            CountryMasterEntity,
            HardwareMasterEntity,
            InfraModuleEntity,
            ClustersEntity,
            InfraHardwareModuleMapperEntity,
            TimezoneEntity,
            CloudServicesEntity,
            HostedZoneEntity,
            CloudRegionEntity,
            CloudAccountEntity,
            CloudProviderEntity,
            ChatEntity,
            ChatSessionEntity,
            InfraAllocationEntity,
            ApiKeyTokenEntity,
            CompanyEntity,
            MembersEntity,
            RolesEntity,
            ModulesEntity,
            RoleModulePermissionEntity,
            MemberLoginsEntity,
            CompanyRoleMapperEntity,
            CompanyMemberRolesEntity,
            ModelEntity,
            ModelCategoryEntity,
            ModelClassEntity,
            ModelGpuMapperEntity,
            ModelLibarariesEntity,
            ModelLicensesEntity,
            ModelProviderEntity,
            ModelTaskEntity,
            ModelTypeEntity,
            ModelQuantizationMapper,
            QuantizationEntity,
            SourceEntity,
            InferencingEntity,
            InviteEntity,
            ModelAPIDetailsEntity,
            CloudSecretsEntity,
            HardwareSpecsEntity,
            InfraNodesEntity,
            InfraSpecsMapperEntity,
            CloudZoneEntity,
            DataSetEntity,
            ModelTrainingEntity,
            AllocationEntity,
            PodDetailsEntity,
            HardwareUtilizationEntity,
            PodLogEntity,
            PricePlanEntity,
            DeploymentQuotaEntity,
            DeploymentQuotaUsageEntity,
            ReservationEntity,
            InviteEntity,
            NotificationEntity,
            InfraQueueEntity,
            ContactUsEntity,
            NodeGroupsEntity,
            NodeGroupMembersEntity,
            BenchmarkingEntity,
            EvaluationTaskEntity,
            KnowledgeBaseEntity,

            EmbeddingModelEntity,
            KnowledgeBaseSourceEntity,
            KnowledgeBaseDatabaseTypeEntity,
            KnowledgeBaseVectorStoreEntity,
            BenchmarkingDatasetEntity,
            DeploymentUsageLedgerEntity,
            BatchInferenceEntity,
            BatchInferenceJobEntity,
            KnowledgeBaseSourceMappingEntity,
            AuditLogEntity,
            AuditLogModuleEntity,
            AuditLogActionEntity,
            DeploymentKbIntegrationEntity,
            KnowledgeBaseJobEntity,
            TrainingWeightsEntity,
            BudgetControlEntity,
            BudgetAlertHistoryEntity,
            WebhookConfigEntity,
            WebhookEntity,
            WebhookIntegratedPlatformEntity,
            WebhookPlatformEntity,
            IntegrationEntity,
            CompanyIntegrationMapperEntity,
            NimModelEntity,
            GuardrailsEntity,
            RbacRolesEntity
        ],

        synchronize: false,
        logging: false,
        // logger: new QueryLogger(500),
        extra: {
            max: 10,
            min: 1,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        },
    });
    return postgresConnection;
}
