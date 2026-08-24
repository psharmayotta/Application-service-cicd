import dotenv from 'dotenv';
if (process.env.NODE_ENV === 'uat') {
    dotenv.config({ path: '.env.uat' });
} else if (process.env.NODE_ENV === 'stage') {
    dotenv.config({ path: '.env.stage' });
} else {
    dotenv.config();
}
export const config = {
    db: {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
    },
    isDev: process.env.NODE_ENV !== 'uat' && process.env.NODE_ENV !== 'stage' && process.env.NODE_ENV !== 'production',
};
export const PATH = `/Infer/api`;
export const PORT = 3210;
export const WEBSOCKET_PORT = 3220;
const parseNumericEnv = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
export const WEBSOCKET_PATH = process.env.WEBSOCKET_PATH || '/websocket';
export const WEBSOCKET_HEARTBEAT_INTERVAL_MS = parseNumericEnv(process.env.WEBSOCKET_HEARTBEAT_INTERVAL_MS, 30000);
export const WEBSOCKET_REDIS_URL = process.env.WEBSOCKET_REDIS_URL || process.env.REDIS_URL || '';
export const WEBSOCKET_REDIS_CHANNEL = process.env.WEBSOCKET_REDIS_CHANNEL || 'ws-broadcast';
export const ENABLE_ENCRYPTION: boolean = true; // enc in production
export const ENCRYPTION_SECRET_KEY = 'YOTTA2024';
export const MODEL_ENDPOINT_URL = process.env.MODEL_ENDPOINT_URL || 'https://adminapi-alpha.q0.new/inference/api/inference/api-key';
export const AUDIO_STREAMING_ENABLED = process.env.AUDIO_STREAMING_ENABLED?.toLowerCase() === 'true';
export const AUDIO_STREAM_WS_URL = process.env.AUDIO_STREAM_WS_URL || '';
export const SALT_ROUNDS = 10
export const UATSECRETNAME = 'infer/UAT';
export const PRODSECRETNAME = 'infer/PROD';
export const JWT_SECRET_KEY = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
export const JWT_EXP = '2d';
export const REFRESH_JWT_EXP = '10d';
export const OTP_EXP_TIME = 120;
export const AWS_SIGNED_URL_EXPIRY = 3600
export const AWS_SECRET_REGION = 'ap-south-1'
export const AWS_S3_FOLDER_NAME = `uploads`
export const DEV_URL = process.env.DEV_URL || 'https://uiapi-alpha.q0.new'
export const CLIENTID = process.env.CLIENTID!;
export const CLIENTSECRET = process.env.CLIENTSECRET!;
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
export const FRONTENDURL = process.env.FRONTENDURL || 'https://ui-alpha.q0.dev/signup'
export const FRONTENDDOMAIN = process.env.FRONTENDDOMAIN || 'https://ui-alpha.q0.dev'
export const LOCALURL = process.env.LOCALURL || 'http://localhost:3210'
export const GRPC_CALL_TIMEOUT_MS = 10000
export const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY!;
export const HUGGINGFACE_API_URL = process.env.HUGGINGFACE_API_URL!;
export const MODALQUANTIZATIONURL = process.env.MODALQUANTIZATIONURL!;
export const MODELTRAININGURL = process.env.MODELTRAININGURL!;
export const DATASETDOWNLOAD = process.env.DATASETDOWNLOAD!;
export const CLOUDFRONTBASEURL = process.env.CLOUDFRONTBASEURL!;
export const CDN_LINK = process.env.CDN_LINK!;
export const DEPLOYMENTURL = process.env.DEPLOYMENTURL!;
export const CHUNK_MANAGEMENT_API_URL = process.env.CHUNK_MANAGEMENT_API_URL || 'https://fileupload-alpha.q0.dev/q0/dev/chunk-edit/';
const COST_FORECAST_ENVIRONMENT_URLS: Record<string, string> = {
    uat: 'https://fileupload-uat.q0.dev/q0/cost-forecast',
    stage: 'https://fileupload-beta.q0.dev/q0/cost-forecast',
};
export const COST_FORECAST_API_URL = process.env.COST_FORECAST_API_URL
    || COST_FORECAST_ENVIRONMENT_URLS[process.env.NODE_ENV || '']
    || 'https://fileupload-alpha.q0.dev/q0/cost-forecast';
export const COST_FORECAST_API_TIMEOUT_MS = parseNumericEnv(process.env.COST_FORECAST_API_TIMEOUT_MS, 10000);
export const INFERENCE_API_URL = process.env.INFERENCE_API_URL || 'https://adminapi-alpha.q0.new/inference/api';
export const COMPILATIONURL = process.env.COMPILATIONURL!;
export const MEMBERAPPROVALREQUESTURL = process.env.MEMBERAPPROVALREQUESTURL || 'https://ui-alpha.q0.new/user-approval-request?token='
export const BCC = []
export const LOKI_URL = process.env.LOKI_URL || "https://uiapi-alpha.q0.new/loki"
export const TENANT_ID = process.env.TENANT_ID || "onprem-tenant"
export const LOKI_METRICS_TENANT = "deployment-metrics" // TODO: change this to deployment-metrics
export const UPLOAD_TRAINING_WEIGHTS_URL = process.env.UPLOAD_TRAINING_WEIGHTS_URL || 'https://fileupload-alpha.q0.dev/upload-training-weights/';
export const TERMINATE_RESOURCES = process.env.TERMINATE_RESOURCES || 'https://fileupload-alpha.q0.dev/q0/budget-terminator/dev/terminate';
export const TERMINATE_RESOURCES_API_KEY = process.env.TERMINATE_RESOURCES_API_KEY || 'b1bb048568df93e19f67e3f42a79da7b7e8c142ad8930f65a170441a526e9a06';

export enum StatusCode {
    SUCCESS = '10000',
    FAILURE = '10001',
    RETRY = '10002',
    INVALID_ACCESS_TOKEN = '10003',
    INVALID_ENCRYPTED_INPUT = '10004',
}

export enum ResponseStatus {
    SUCCESS = 200,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_FOUND = 405,
    INTERNAL_ERROR = 500,
    HTTP_402 = 402
}

export enum nonTokenAPIs {
    '/security/saltencryption',
    '/security/encryption',
    '/security/decryption',
    '/inference',
    '/model/my-model/update-status',
    '/model-training/update-status',
    '/dataset/update-status',
    '/company-member-roles/approve',
    '/company-member-roles/reject'
}

export enum APILangauge {
    PYTHON = "python",
    CURL = "curl",
    JAVASCRIPT = "javascript",
    JAVA = "java",
    GO = "go",
}

export enum DEPLOYMENTPROCESS {
    CREATE = "CREATE",
    PAUSE = "PAUSE",
    DELETE = "DELETE",
    RESUME = "RESUME",
}
//added comment
export enum InfraAllocationStatus {
    RUNNING = 'running'
}

export enum InfraAllocationModuleType {
    MODEL = 'model',
    TRAINING = 'training',
    KNOWLEDGE_BASE = 'knowledge_base',
    DEPLOYMENT = 'deployment',
}

export enum CloudAccountOwnership {
    PRIVATE = 'Private',
    PUBLIC = 'Public',
}

export enum InfraNodesStatus {
    AVAILABLE = 'available',
    ALLOCATED = 'allocated',
    MAINTENANCE = 'maintenance',
    FAULTY = 'faulty',
    DECOMMISSIONED = 'decommissioned',
}


export enum DeploymentStatus {
    PENDING = 'PENDING',
    START = 'START',
    READY = 'READY',
    END = 'END',
    PAUSED = 'PAUSED',
    DELETED = 'DELETED',
    FAILED = 'FAILED'
}

export enum DeploymentType {
    PLAYGROUND = 'playground',
    MYMODEL = 'mymodel',
    TRAINING = 'training',
    DOCKER = 'docker',
    NIM = 'nim'
}


export enum HardwareComponentType {
    CPU = 'CPU',
    GPU = 'GPU',
    STORAGE = 'STORAGE'
}

export enum StorageType {
    HDD = 'HDD',
    SSD = 'SSD',
    NVME = 'NVME'
}

export const KAFKAPRODUCERS = {
    MYMODEL: process.env.TOPIC_MY_MODEL_INIT || 'dev-my-model-init',
    TRAINING: process.env.TOPIC_TRAINING || 'training',
    DEPLOYMENT: process.env.TOPIC_DEPLOYMENT_INIT || 'dev-deployment-init',
    BENCHMARKINGINIT: process.env.TOPIC_BENCHMARKING_INIT || 'dev-benchmarking-init',
    REQUESTINIT: process.env.TOPIC_REQUEST_INIT || "req-init",
    COMPILEINIT: process.env.TOPIC_COMPILE_INIT || 'compile-init',
    DEPLOYMENTCOST: process.env.TOPIC_DEPLOYMENT_COST || 'deployment-cost-caculate',
    EMAIL: process.env.TOPIC_EMAIL_INIT || 'email-init',
    DATASETINIT: process.env.TOPIC_DATASET_INIT || 'dev-dataset-init',
    TRAININGINIT: process.env.TOPIC_TRAINING_INIT || 'dev-training-init',
    CREDITCALCULATE: process.env.TOPIC_CREDIT_CALCULATE || 'calculate-credit-new',
    RAGINIT: process.env.TOPIC_RAG_INIT || 'dev-rag-init',
    BATCH_INFERENCE: process.env.TOPIC_BATCH_INFERENCE_INIT || 'dev-batch-inference-init',
    EVALUATION_INIT: process.env.TOPIC_EVALUATION_INIT || 'dev-eval-init',
    QUOTA_REACHED: process.env.TOPIC_QUOTA_REACHED || 'dev-quota-reached',
    GUARDRAILINIT: process.env.TOPIC_GUARDRAIL_INIT || 'dev-guardrail-init',
} as const;

export const KAFKACONSUMER = {
    MYMODEL: process.env.TOPIC_MY_MODEL_STATUS || 'dev-my-model-status',
    TRAINING: process.env.TOPIC_TRAINING_STATUS || 'dev-training-status',
    REQUESTINIT: process.env.TOPIC_REQUEST_INIT || "req-init",
    NOTIFICATIONINIT: process.env.TOPIC_NOTIFICATION_INIT || 'dev-credit-notification-init',
    PODLIFECYCLE: process.env.TOPIC_POD_LIFECYCLE || 'onprem-dev-pod-lifecycle',
    COMPILESTATUS: process.env.TOPIC_COMPILE_STATUS || 'compile-status',
    TRAININGSTATUS: process.env.TOPIC_TRAINING_STATUS || 'dev-training-status',
    PLAYGROUNDTOKENIZER: process.env.TOPIC_PLAYGROUND_TOKENIZER || 'playground-tokenizer',
    CALCULATECREDIT: process.env.TOPIC_CREDIT_CALCULATE || 'calculate-credit-new',
    DATASETSTATUS: process.env.TOPIC_DATASET_STATUS || 'dev-dataset-status',
    NODESNAPSHOT: process.env.TOPIC_NODE_SNAPSHOT || 'onprem-node-snapshot',
    FETCHUPDATEDCREDIT: process.env.TOPIC_FETCH_UPDATED_CREDIT || 'fetch-updated-credit',
    DEPLOYMENTSTATUS: process.env.TOPIC_DEPLOYMENT_STATUS || 'dev-deployment-status',
    RAGSTATUS: process.env.TOPIC_RAG_STATUS || 'dev-rag-status',
    BENCHMARKINGINFO: process.env.TOPIC_BENCHMARKING_INFO || 'dev-benchmark-results',
    BATCH_INFERENCE_STATUS: process.env.TOPIC_BATCH_INFERENCE_STATUS || 'dev-batch-inference-status',
    BATCH_INFERENCE_RESULT: process.env.TOPIC_BATCH_INFERENCE_RESULT || 'dev-batch-inference-results',
    BENCHMARKINGSTATUS: process.env.TOPIC_BENCHMARKING_STATUS || 'dev-benchmark-status',
    EVALUATION_INIT: process.env.TOPIC_EVALUATION_INIT || 'dev-eval-init',
    EVALUATION_STATUS: process.env.TOPIC_EVALUATION_STATUS || 'dev-eval-status',
    EVALUATION_RESULT: process.env.TOPIC_EVALUATION_RESULT || 'dev-eval-result',
    TRAINING_WEIGHTS_STATUS: process.env.TOPIC_TRAINING_WEIGHTS_STATUS || 'dev-training-weights-status',
    QUOTA_REACHED: process.env.TOPIC_QUOTA_REACHED || 'dev-quota-reached',
} as const;


export enum MyModelStatus {
    QUEUED = 'QUEUED',
    FAILED = 'FAILED',
    JOB_RECEIVED = 'JOB_RECEIVED',
    ACCEPTED = 'ACCEPTED',
    LAUNCHED_OPTIMISATION_CLUSTER = 'LAUNCHED_OPTIMISATION_CLUSTER',
    STARTING_MODEL_DOWNLOAD = 'STARTING_MODEL_DOWNLOAD',
    MODEL_DOWNLOADED = 'MODEL_DOWNLOADED',
    QUANTIZATION_STARTING = 'QUANTIZATION_STARTING',
    QUANTIZATION_COMPLETED = 'QUANTIZATION_COMPLETED',
    SAVING_AND_UPLOADING = 'SAVING_AND_UPLOADING',
    SAVING_DONE = 'SAVING_DONE',
    UPLOADING_DONE = 'UPLOADING_DONE',
    CLEANED_UP = 'CLEANED_UP',
    MODEL_READY = 'MODEL_READY',
    SUCCESS = 'SUCCESS'
}

export enum ReservationAction {
    create = 'create',
    delete = 'delete'
}

export enum CloudServiceType {
    COMPUTE = "compute",
    STORAGE = "storage",
    DATABASE = "database",
    NETWORKING = "networking",
    MONITORING = "monitoring",
    SECURITY = "security",
    AI_ML = "ai_ml",
    DEVOPS = "devops",
}

export enum InfraHardwareModuleMapperStatus {
    RESERVED = 'Reserved',
    ASSIGNED = 'Assigned',
    RELEASED = 'Released'
}

export enum DatasetFormat {
    OpenAI = 'openAI',
    ShareGPT = 'ShareGPT',
    CUSTOM = 'custom'
}

export enum DatasetType {
    json = '.json',
    csv = '.csv',
    tsv = '.tsv',
    txt = '.txt',
    xml = '.xml',
    jsonl = '.jsonl',
    zip = '.zip',
}

export enum DatasetStatus {
    FAILED = 'Failed',
    PENDING = 'Pending',
    UPLOADING = 'Uploading',
    SUCCESS = 'Success'
}

export enum ModelTrainingStatus {
    PENDING = 'PENDING',
    QUEUED = 'QUEUED',
    TRAINING_RECEIVED = 'TRAINING_RECEIVED',
    DOWNLOADING_DATA = 'DOWNLOADING_DATA',
    TRAINING_STARTED = 'TRAINING_STARTED',
    TRAINING_COMPLETED = 'TRAINING_COMPLETED',
    SAVING_WEIGHTS = 'SAVING_WEIGHTS',
    UPLOADING_WEIGHTS = 'UPLOADING_WEIGHTS',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

export enum TrainingType {
    SUPERVISED = 'Supervised',
    REINFORCEMENT = 'Reinforcement'
}

export enum BenchmarkingType {
    HARDWARE = 'Hardware Benchmarking',
    MODEL = 'Model Benchmarking',
    RAG = 'RAG Benchmarking',
    MODEL_EVALUATION = 'Model Evaluation'
}

export enum BenchmarkingStatus {
    PENDING = 'Pending',
    RUNNING = 'Running',
    COMPLETED = 'Completed',
    FAILED = 'Failed'
}

export enum ModelBenchmarkingStatus {
    PENDING = 'Pending',
    VERIFYING_MODEL = 'Verifying Model',
    MODEL_DEPLOY = 'Model Deploy',
    DATASET_VERIFY = 'Dataset Verify',
    BENCHMARKING = 'Benchmarking',
    COMPLETED = 'Completed',
    FAILED = 'Failed'
}

export enum InfraQueueStatus {
    PENDING = 'Pending',
    PROCESSING = 'Processing',
    COMPLETED = 'Completed',
    FAILED = 'Failed'
}

export enum InfraQueueModuleType {
    TRAINING = 'training',
    MODEL = 'model'
}

export enum ClusterEnvironment {
    DEVELOPMENT = 'development',
    PRODUCTION = 'production',
    DEMO = 'demo',
    OTHER = 'other',
}

export enum ClusterType {
    IMPORT = 'import',
    CREATED = 'created',
}

export enum ClusterStatus {
    QUEUED = 'queued',
    ACCEPTED = 'accepted',
    FAILED = 'failed'
}

export enum UsagePresetFilter {
    LAST_30_MIN = 'minutes',
    LAST_2_HOUR = '15minutes',
    LAST_12_HOUR = '30minutes',
    LAST_24_HOUR = 'hours',
    LAST_1_WEEK = 'day',
    LAST_1_MONTH = 'day',
    LAST_3_MONTH = 'week',
    LAST_6_MONTH = 'week',
    LAST_1_YEAR = 'week',
}

export enum PrivateEndPointPresetFilter {
    LAST_30_MIN = 'minutes',
    LAST_2_HOUR = '15minutes',
    LAST_12_HOUR = '30minutes',
    LAST_24_HOUR = 'hours',
    LAST_1_WEEK = '6hours',
    LAST_1_MONTH = '12hours',
    LAST_3_MONTH = 'day',
    LAST_6_MONTH = 'day',
    LAST_1_YEAR = 'day',
}



export enum NodeAntiAffinity {
    REQUIRED = 'required',
    NOTREQUIRED = 'notrequired',
    PREFERRED = 'preferred',
}

export enum TimeZone {
    UTC = 'UTC',
    Asia = 'Asia/Kolkata',
    LOCAL = 'Local (Browser timezone)'
}

export const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY!
export const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY!
export const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME!
export const AWS_LOCATION = process.env.AWS_LOCATION!
export const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL!
export const QDRANT_DB_URL = process.env.QDRANT_DB_URL;


export const BOOTSTRAP = process.env.BOOTSTRAP!;
export const USERNAME = process.env.USERNAME!;
export const PASSWORD = process.env.PASSWORD!;
export const GROUP_ID = "my-consumer-group";
export const MECHANISMS = process.env.KAFKA_SASL_MECHANISMS || "SCRAM-SHA-256";

export const GPU_RESERVATION_TOPIC = process.env.NODE_ENV === 'production'
    ? 'prod-gpu-reservation'
    : (process.env.NODE_ENV === 'uat' ? 'uat-gpu-reservation' : 'dev-gpu-reservation');

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key: string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> { }
export interface ReplaceOptions {
    parseReplacedJson?: boolean;
}

export enum ModuleType {
    TRAINING = 'Training',
    TRAINING_WEIGHTS = 'TrainingWeights',
    MYMODEL = 'Mymodel',
    DEPLOYMENT = 'Deployment',
    COMPILE = 'Compile',
    PLAYGROUND = 'Playground',
    EMAIL = 'Email',
    NOTIFICATION = 'Notification',
    DATASET = 'Dataset',
    CREDIT = 'Credit',
    BENCHMARKING = 'Benchmarking',
    RAG = 'Rag',
    BATCH_INFERENCE = 'BatchInference',
    KNOWLEDGEBASE_SOURCE = 'knowledgebase_source'
}

export enum ModelModuleType {
    TRAINING = 'TRAINING',
    MYMODEL = 'MYMODEL',
    PLAYGROUND = 'PLAYGROUND',
    DOCKER = 'DOCKER',
    NIM = 'NIM'
}

export enum ModuleTypeQuota {
    PLAYGROUND = 'PLAYGROUND',
    DEPLOYMENT = 'DEPLOYMENT'
}

export enum QuotaStatus {
    PENDING = 'Pending',
    APPROVED = 'Approved',
    REJECTED = 'Rejected'
}

export enum NotificationType {
    CREATED = 'Created',
    ADDED = 'Added',
    UPDATED = 'Updated',
    DELETED = 'Deleted',
    SUCCESS = 'Success',
    FAILED = 'Failed'
}

export const LokiModule = {
    MYMODEL: process.env.MYMODEL_LOGS || 'dev-add-models',
    DEPLOYMENT: process.env.DEPLOYMENT_LOGS || 'dev-dedicated-deployment',
    TRAINING: process.env.TRAINING_LOGS || 'dev-training-models',
    KNOWLEDGEBASE: process.env.KNOWLEDGEBASE_LOG || 'dev-rag',
};


export enum WalletStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
}

export enum WalletTxnType {
    CREDIT = 'CREDIT',
    DEBIT = 'DEBIT'
}
export enum WalletTxnReferenceType {
    PLAYGROUND = 'PLAYGROUND',
    PAYMENT = 'PAYMENT',
    REFUND = 'REFUND',
    ORDER = 'ORDER',
    ADJUSTMENT = 'ADJUSTMENT',
    DEPLOYMENT = 'DEPLOYMENT',
    SIGNUP_BONUS = 'SIGNUP_BONUS',
    BENCHMARKING = 'BENCHMARKING',
    BATCH_INFERENCE = 'BATCH_INFERENCE',
    KNOWLEDGEBASE = 'KNOWLEDGEBASE',
    DATASET = 'DATASET'
}
export enum WalletTxnStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REVERSED = 'REVERSED'
}

export enum PaymentGateway {
    PHONEPE = 'PHONEPE',
    RAZORPAY = 'RAZORPAY',
    STRIPE = 'STRIPE',
    PAYTM = 'PAYTM'
}
export enum PaymentStatus {
    INITIATED = 'INITIATED',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    CANCELLED = 'CANCELLED'
}

export enum RechargeStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
}

export enum RefundStatus {
    INITIATED = 'INITIATED',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
}

export enum ChunkingType {
    DEFAULT = 'Default',
    FIXED_SIZE = 'Fixed-Size',
    HIERARCHICAL = 'Hierarchical',
    SEMANTIC = 'Semantic',
    NO_CHUNKING = 'No',
}

export enum KnowledgeBaseSourceType {
    CLOUD_STORAGE = 'CLOUD_STORAGE',
    API = 'API',
    DATABASE = 'DATABASE',
    FILE_UPLOAD = 'FILE_UPLOAD',
}

export enum KnowledgeBaseStatus {
    PENDING = 'PENDING',
    REQUEST_RECEIVED = 'REQUEST_RECEIVED',
    PREPARING_DATA = 'PREPARING_DATA',
    PROCESSING_DOCUMENTS = 'PROCESSING_DOCUMENTS',
    CREATING_EMBEDDINGS = 'CREATING_EMBEDDINGS',
    SAVING_TO_KNOWLEDGE_BASE = 'SAVING_TO_KNOWLEDGE_BASE',
    FAILED = 'FAILED',
}

export enum KnowledgeBaseJobStatus {
    PENDING = 'PENDING',
    REQUEST_RECEIVED = 'REQUEST_RECEIVED',
    FAILED = 'FAILED',
    PREPARING_DATA = 'PREPARING_DATA',
    PROCESSING_DOCUMENTS = 'PROCESSING_DOCUMENTS',
    CREATING_EMBEDDINGS = 'CREATING_EMBEDDINGS',
    SAVING_TO_KNOWLEDGE_BASE = 'SAVING_TO_KNOWLEDGE_BASE',
    COMPLETED = 'COMPLETED',
}

export enum BatchJobStatus {
    PENDING = 'PENDING',
    RUNNING = 'RUNNING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
    PAUSED = 'PAUSED',
    QUEUED = 'QUEUED'
}
export enum BudgetPeriodType {
    DAILY = 'Daily',
    MONTHLY = 'Monthly'
}

export enum WebhookPlatform {
    MAIL = 'MAIL',
    SLACK = 'SLACK',
    TEAMS = 'TEAMS',
    PAGERDUTY = 'PAGERDUTY',
    VICTOROPS = 'VICTOROPS'
}

export enum WebhookEvents {
    BUDGET_BREACH = 'BUDGET_BREACH',
    QUOTA_REACHED = 'QUOTA_REACHED',
    TRAINING = 'Training',
    MYMODEL = 'Mymodel',
    DEPLOYMENT = 'Deployment',
    BENCHMARKING = 'Benchmarking',
    BATCH_INFERENCE = 'BatchInference',
    RAG = 'Rag',
    CREDIT = 'Credit',
    INVITE = 'Invite',
    QUOTA = 'Quota',
    DATASET = 'Dataset'
}

// added for encryption and decryption
export const NON_ENCRYPTION_ENDPOINTS = [`${PATH}/security/encryption`, `${PATH}/security/decryption`, `${PATH}/security/saltencryption`, `${PATH}/inference`, `${PATH}/inference/api-key`, `${PATH}/model/my-model/update-status`, `${PATH}/model-training/update-status`, `${PATH}/dataset/update-status`, `${PATH}/pub/api/v1/sync-ext-customer`, `${PATH}/pub/api/v1/get-ext-customer`, `${PATH}/pub/api/v1/generate-token`, `${PATH}/validate-api-key/validate`, `${PATH}/playground/model-details`];
