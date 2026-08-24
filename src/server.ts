import './tracing';
import dotenv from 'dotenv';
import { PORT } from './config';
import { App } from './app';
import { SecuirtyController } from './controllers/secuirtyController/secuirtyController.controller';
import { APP_ROUTES } from './core/AppRoutes';
import { CompanyController } from './controllers/company/companyController.controller';
import { APIHealthCheckController } from './controllers/apiHealthCheck/apiHealthCheckController.controller';
import { RolesController } from './controllers/roles/rolesController.controller';
import { ModulesController } from './controllers/modules/modulesController.controller';
import { RoleModulePermissionController } from './controllers/roleModulePermission/roleModulePermissionController.controller';
import { MemberController } from './controllers/member/memberController.controller';
import { MemberLoginsController } from './controllers/memberLogins/memberLoginsController.controller';

import { ModelController } from './controllers/model/modelController.controller';
import { LoginController } from './controllers/loginController/loginController';
import { RegisterationController } from './controllers/registration/registerationController';
import { APIKeyTokenController } from './controllers/apiKeyToken/apiKeyTokenController.controller';
import { InviteController } from './controllers/invite/inviteController.controller';
import { PlaygroundController } from './controllers/playground/playgroundController.controller';
import { CloudSecretsController } from './controllers/cloudSecrets/cloudSecretsController';
import { InferenceController } from './controllers/inference/inferenceController.controller';
import { ChatSessionController } from './controllers/chatSession/chatSessionController.controller';
import { UsageController } from './controllers/usage/usageController.controller';
import { CloudProviderController } from './controllers/cloudProvider/cloudProviderController.controller';
import { LogoutController } from './controllers/logout/logoutController';
import { RefreshTokenController } from './controllers/login/refreshTokenController';
import { HuggingFaceRepoVerificationController } from './controllers/huggingFaceRepoVerification/huggingFaceRepoVerificationController.controller';
import { ModelClassController } from './controllers/modelClass/modelClassController.controller';
import { CloudAccountController } from './controllers/cloudAccount/cloudAccountController.controller';
import { HostedZoneController } from './controllers/hostedZone/hostedZoneController.controller';
import { GetCloudSecretController } from './controllers/cloudAccount/getSecretController.controller';
import { CloudRegionController } from './controllers/cloudRegion/cloudRegionController.controller';
import { MyModelController } from './controllers/myModel/myModelController.controller';
import { HardwareSpecsController } from './controllers/hardwareSpeces/hardwareSpecsController.controller';
import { CloudServiceController } from './controllers/cloudService/cloudController.controller';
import { TimezoneController } from './controllers/timezone/timezoneController.controller';
import { PrivateEndPointModelController } from './controllers/usage/privateEndPointModelController.controller';
import { InfraNodesController } from './controllers/infraNodes/infraNodesController.controller';
import { DatasetController } from './controllers/dataSet/dataSetController.controller';
import { ModelTrainingController } from './controllers/modelTraining/modelTrainingController.controller';
import { ModelCategoryController } from './controllers/modelCategory/modelCategoryController.controller';
import { ModelTaskController } from './controllers/modelTask/modelTaskController.controller';
import { ClustersController } from './controllers/clusters/clustersController.controller';
import { GetClustersController } from './controllers/deployments/getClusterController.controller';
import { DeploymentController } from './controllers/deployments/deploymentController.controller';
import { AllocationController } from './controllers/allocation/allocationController.controller';
import { PodDetailsController } from './controllers/podDetails/podDetailsController.controller';
import { HardwareUtilizationController } from './controllers/hardwareUtilization/hardwareutilizationController.controller';
import { GetScalingMetricController } from './controllers/deployments/getScalingMetricsController.controller';
import { DeploymentModelController } from './controllers/deployments/deploymentModelController.controller';
import { WalletController } from './controllers/wallet/walletController.controller';
import { PrivateEndPointDashboardController } from './controllers/usage/privateEndPointDashboardController.controller';
import { MarketPlaceFilterController } from './controllers/model/marketPlaceFilterController.controller';
import { AccessManagementController } from './controllers/accessManagement/accessManagementController';
import { RbacRolesController } from './controllers/rbacRoles/rbacRolesController.controller';
import { UpdatePasswordController } from './controllers/login/updatePasswordController';
import { JoinCompanyController } from './controllers/company/joinCompanyController.controller';
import { DeploymentQuotaController } from './controllers/quota/deploymentQuotaController.controller';
import { ReservationController } from './controllers/reservation/reservationController.controller';
import { DocsCmsPageRelationController } from './controllers/docs/docsCmsPageRelationController.controller';
import { NotificationController } from './controllers/notification/notificationController.controller';
import { CompanyMemberRolesController } from './controllers/companyMemberRoles/companyMemberRolesController.controller';
import { LokiLogController } from './controllers/lokiLog/lokiLogController.controller';
import { ModelTrainingListingController } from './controllers/modelTraining/modelTrainingListingController.controller';
import { TrainingWeightsController } from './controllers/modelTraining/trainingWeightsController.controller';
import { DashboardController } from './controllers/dashboard/dashboardController.controller';
import { MonthlyBillingController } from './controllers/monthlyBilling/monthlyBillingController.controller';
import { HardwareMasterController } from './controllers/hardwareMaster/hardwareMasterController.controller';
import { ContactUsController } from './controllers/contactUs/contactUsController.controller';
import { BillingUsageController } from './controllers/monthlyBilling/billingUsageController.controller';
import { NodeGroupsController } from './controllers/nodeGroups/nodeGroupsController.controller';
import { DeploymentMetricsController } from './controllers/deployments/deploymentMetricsController.controller';
import { KnowledgeBaseController } from './controllers/knowledgeBase/knowledgeBaseController.controller';

import { EmbeddingModelController } from './controllers/embeddingModel/embeddingModelController.controller';
import { PrivateEndPointGraphController } from './controllers/privateEndpoints/privateEndPointGraphController.controller';
import { BenchmarkingController } from './controllers/benchmarking/benchmarkingController.controller';
import { EvaluationTaskController } from './controllers/benchmarking/evaluationTaskController.controller';
import { InferenceSettingController } from './controllers/benchmarking/inferenceSettingController.controller';
import { KnowledgeBaseSourceController } from './controllers/knowledgeBase/knowledgeBaseSourceController.controller';
import { KnowledgeBaseSourceMappingController } from './controllers/knowledgeBase/knowledgeBaseSourceMappingController.controller';
import { KnowledgeBaseDatabaseTypeController } from './controllers/knowledgeBase/knowledgeBaseDatabaseTypeController.controller';
import { KnowledgeBaseVectorStoreController } from './controllers/knowledgeBase/knowledgeBaseVectorStoreController.controller';
import { BenchmarkingDatasetController } from './controllers/benchmarking/benchmarkingDatasetController.controller';
import { BatchInferenceController } from './controllers/batchInference/batchInferenceController.controller';
import { BatchInferenceJobController } from './controllers/batchInference/batchInferenceJobController.controller';

import { KnowledgeBaseJobController } from './controllers/knowledgeBase/knowledgeBaseJobController.controller';
import { DeploymentKbListingController } from './controllers/knowledgeBase/deploymentKbListingController.controller';
import { DeploymentKbIntegrationController } from './controllers/knowledgeBase/deploymentKbIntegrationController.controller';

import { BatchInferenceScheduler } from './services/batchInference/batchInferenceScheduler';
import { KnowledgeBaseScheduler } from './services/knowledgeBase/knowledgeBaseScheduler';
import { GpuCostController } from './controllers/gpuCost/gpuCostController.controller';
import { ValidateApiKeyController } from './controllers/apiKeyToken/validateApiKeyController.controller';
import { BudgetControlController } from './controllers/budgetControl/budgetControlController.controller';
import { WebhookController } from './controllers/webhookConfig/webhookController.controller';
import { WebhookPlatformController } from './controllers/webhookConfig/webhookPlatformController.controller';
import { IntegrationController } from './controllers/integration/integrationController.controller';
import { AuditLogController } from './controllers/auditLog/auditLogController.controller';
import { GuardrailsController } from './controllers/guardrails/guardrailsController.controller';
import { PublicModelController } from './controllers/publicModel/publicModelController.controller';

dotenv.config();

// Log key environment variables at startup (values masked for secrets)
const envKeysToLog = [
    'NODE_ENV', 'PORT', 'AWS_ACCESS_KEY', 'AWS_SECRET_KEY', 'AWS_BUCKET_NAME',
    'AWS_LOCATION', 'AWS_ENDPOINT_URL', 'NODE_EXTRA_CA_CERTS', 'CDN_LINK',
    'KAFKA_BOOTSTRAP', 'KAFKA_USERNAME', 'KAFKA_PROTOCOL', 'KAFKA_MECH',
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'FRONTENDURL'
];
const SECRET_KEYS = ['AWS_SECRET_KEY', 'KAFKA_PASSWORD', 'DB_PASSWORD'];

console.log('========== ENV CONFIG ==========');
envKeysToLog.forEach(key => {
    const val = process.env[key];
    if (!val) {
        console.log(`  ${key}: <not set>`);
    } else if (SECRET_KEYS.includes(key)) {
        console.log(`  ${key}: ****${val.slice(-4)}`);
    } else {
        console.log(`  ${key}: ${val}`);
    }
});
console.log('================================');


(async function () {
    try {
        const app = new App([
            new PrivateEndPointGraphController(APP_ROUTES.PRIVATEENDPOINT),
            new DeploymentMetricsController(APP_ROUTES.DEPLOYMENT),
            new PrivateEndPointDashboardController(APP_ROUTES.PRIVATEENDPOINT),
            new WalletController(APP_ROUTES.WALLET),
            new GetScalingMetricController(APP_ROUTES.GETSCALINGMETRICS),
            new DeploymentController(APP_ROUTES.DEPLOYMENT),
            new GetClustersController(APP_ROUTES.GETCLUSTERS),
            new ClustersController(APP_ROUTES.CLUSTERS),
            new InfraNodesController(APP_ROUTES.INFRANODES),
            new PrivateEndPointModelController(APP_ROUTES.PRIVATEMODEL),
            new TimezoneController(APP_ROUTES.TIMEZONE),
            new CloudServiceController(APP_ROUTES.CLOUDSERVICE),
            new CloudRegionController(APP_ROUTES.CLOUDREGION),
            new GetCloudSecretController(APP_ROUTES.GETSECRETALONGCLOUD),
            new HostedZoneController(APP_ROUTES.HOSTEDZONE),
            new CloudAccountController(APP_ROUTES.CLOUDACCOUNT),
            new CloudProviderController(APP_ROUTES.CLOUDPROVIDER),
            new UsageController(APP_ROUTES.USAGE),
            new ChatSessionController(APP_ROUTES.CHATSESSION),
            new APIHealthCheckController(APP_ROUTES.APIHEALTHCHECK),
            new CompanyController(APP_ROUTES.COMPANY),
            new SecuirtyController(APP_ROUTES.SECURITY),
            new RolesController(APP_ROUTES.ROLES),
            new ModulesController(APP_ROUTES.MODULES),
            new RoleModulePermissionController(APP_ROUTES.ROLE_MODULE_PERMISSION),
            new MemberController(APP_ROUTES.MEMBERS),
            new MemberLoginsController(APP_ROUTES.MEMBERSLOGINS),
            new LoginController(APP_ROUTES.LOGIN),
            new ModelController(APP_ROUTES.MODEL),
            new APIKeyTokenController(APP_ROUTES.APIKEYTOKEN),
            new InviteController(APP_ROUTES.INVITE),
            new PlaygroundController(APP_ROUTES.PLAYGROUND),
            new CloudSecretsController(APP_ROUTES.CLOUD_SECRETS),
            new InferenceController(APP_ROUTES.INFERENCE),
            new LogoutController(APP_ROUTES.LOGOUT),
            new RefreshTokenController(APP_ROUTES.REFRESHTOKEN),
            new HuggingFaceRepoVerificationController(APP_ROUTES.HUGGING_FACE_REPO_VERIFICATION),
            new ModelClassController(APP_ROUTES.MODELCLASS),
            new MyModelController(APP_ROUTES.MY_MODEL),
            new HardwareSpecsController(APP_ROUTES.HARDWARESPECS),
            new HostedZoneController(APP_ROUTES.HOSTEDZONE),
            new DatasetController(APP_ROUTES.DATASET),
            new ModelTrainingController(APP_ROUTES.MODELTRAINING),
            new BenchmarkingController(APP_ROUTES.BENCHMARKING),
            new ModelCategoryController(APP_ROUTES.MODELCATEGORY),
            new ModelTaskController(APP_ROUTES.MODELTASK),
            new AllocationController(APP_ROUTES.ALLOCATION),
            new PodDetailsController(APP_ROUTES.PODDETAILS),
            new HardwareUtilizationController(APP_ROUTES.HARDWAREUTILIZATION),
            new DeploymentModelController(APP_ROUTES.DEPLOYMENTMODEL),
            new MarketPlaceFilterController(APP_ROUTES.MARKETPLACEFILTER),
            new AccessManagementController(APP_ROUTES.ACCESS_MANAGEMENT),
            new RbacRolesController(APP_ROUTES.RBAC_ROLES),
            new UpdatePasswordController(APP_ROUTES.UPDATEPASSWORD),
            new JoinCompanyController(APP_ROUTES.JOIN_COMPANY),
            new DeploymentQuotaController(APP_ROUTES.DEPLOYMENTQUOTA),
            new ReservationController(APP_ROUTES.RESERVATION),
            new DocsCmsPageRelationController(APP_ROUTES.DOCSCMSPAGERELATION),
            new NotificationController(APP_ROUTES.NOTIFICATION),
            new CompanyMemberRolesController(APP_ROUTES.COMPANY_MEMBER_ROLES),
            new LokiLogController(APP_ROUTES.LOKI_LOGS),
            new ModelTrainingListingController(APP_ROUTES.MODELTRAININGLISTING),
            new DashboardController(APP_ROUTES.DASHBOARD),
            new MonthlyBillingController(APP_ROUTES.MONTHLY_BILLING),
            new HardwareMasterController(APP_ROUTES.HARDWAREMASTER),
            new ContactUsController(APP_ROUTES.CONTACTUS),
            new BillingUsageController(APP_ROUTES.BILLING_USAGE),
            new NodeGroupsController(APP_ROUTES.NODEGROUPS),
            new KnowledgeBaseController(APP_ROUTES.KNOWLEDGE_BASE),
            new EmbeddingModelController(APP_ROUTES.EMBEDDING_MODEL),
            new InferenceSettingController(APP_ROUTES.INFERENCE_SETTING),
            new KnowledgeBaseSourceController(APP_ROUTES.KNOWLEDGE_BASE_SOURCE),
            new KnowledgeBaseSourceMappingController(APP_ROUTES.KNOWLEDGE_BASE_SOURCE_MAPPING),
            new KnowledgeBaseDatabaseTypeController(APP_ROUTES.DATABASE_TYPE),
            new KnowledgeBaseVectorStoreController(APP_ROUTES.KNOWLEDGE_BASE_VECTOR_STORE),
            new BenchmarkingDatasetController(APP_ROUTES.BENCHMARKING_DATASET),
            new EvaluationTaskController(APP_ROUTES.EVALUATION_TASKS),
            new BatchInferenceController(APP_ROUTES.BATCH_INFERENCE),
            new BatchInferenceJobController(APP_ROUTES.BATCH_INFERENCE_JOB),

            new KnowledgeBaseJobController(APP_ROUTES.KNOWLEDGE_BASE_JOB),
            new DeploymentKbListingController(APP_ROUTES.KNOWLEDGE_BASE_DEPLOYMENTS),
            new DeploymentKbIntegrationController(APP_ROUTES.KNOWLEDGE_BASE_DEPLOYMENT_INTEGRATION),
            new TrainingWeightsController(APP_ROUTES.TRAINING_WEIGHTS),
            new GpuCostController(APP_ROUTES.GPU_COST),
            new ValidateApiKeyController(APP_ROUTES.VALIDATE_API_KEY),
            new BudgetControlController(APP_ROUTES.BUDGET_CONTROL),
            new WebhookController(APP_ROUTES.WEBHOOK_CONFIG),
            new WebhookPlatformController(APP_ROUTES.WEBHOOK_PLATFORMS),
            new IntegrationController(APP_ROUTES.INTEGRATIONS),
            new RegisterationController(APP_ROUTES.YOTTA_INTEGRATION),
            new AuditLogController(APP_ROUTES.AUDIT_LOG),
            new GuardrailsController(APP_ROUTES.GUARDRAILS),
            new PublicModelController(APP_ROUTES.PUBLIC_MODELS),
        ],
            PORT);

        app.listen();

        // Start the Batch Inference Scheduler
        BatchInferenceScheduler.getInstance().start();

        // Start the Knowledge Base Scheduler
        KnowledgeBaseScheduler.getInstance().start();
    } catch (error) {
        console.error('Error initializing the app:', error);
    }
})();
