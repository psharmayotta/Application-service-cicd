/**
 * Webhook Message Templates
 * 
 * Central config for all webhook alert messages across modules and platforms.
 * Each template defines: subject (email/title), body text, status badge, facts table, and CTA button.
 * 
 * Variables use {placeholder} syntax — replaced at dispatch time.
 * 
 * Usage:
 *   getWebhookTemplate('Deployment', 'READY') → returns the template for deployment ready event
 */

export interface WebhookFact {
    name: string;
    value: string;
}

export interface WebhookTemplate {
    subject: string;
    body: string;
    status?: string;
    statusIcon?: string;       // emoji/icon for status badge
    facts?: WebhookFact[];
    ctaText?: string;
    ctaUrl?: string;           // relative path appended to frontend domain
}

export interface WebhookTemplateVariables {
    name?: string;
    userName?: string;
    workspace?: string;
    email?: string;
    company_name?: string;
    period?: string;
    totalSpent?: string;
    budget?: string;
    percentage?: string;
    quota_type?: string;
    limit?: string;
    used?: string;
    request_for?: string;
    [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPLOYMENT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const DeploymentTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{name} deployment created.',
        body: '{userName} created a new Deployment - {name} in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    NIM_CREATED: {
        subject: '{name} NIM deployment created.',
        body: '{userName} created a new NIM Deployment - {name} in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    READY: {
        subject: '{name} successfully deployed.',
        body: '{name} deployed in {workspace} Workspace.',
        status: 'Completed',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Completed' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    PAUSED: {
        subject: '{name} deployment paused.',
        body: '{name} deployment paused in {workspace} Workspace.',
        status: 'Paused',
        statusIcon: '⏸',
        facts: [{ name: 'Status', value: '⏸ Paused' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    FAILED: {
        subject: '{name} deployment failed.',
        body: '{name} deployment failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    STARTED: {
        subject: '{name} deployment started.',
        body: '{name} deployment started in {workspace} Workspace.',
        status: 'Started',
        statusIcon: '▶',
        facts: [{ name: 'Status', value: '▶ Started' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    RESUMED: {
        subject: '{name} deployment resumed.',
        body: '{name} deployment resumed in {workspace} Workspace.',
        status: 'Resumed',
        statusIcon: '▶',
        facts: [{ name: 'Status', value: '▶ Resumed' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
    DELETED: {
        subject: '{name} deployment deleted.',
        body: '{name} deployment deleted in {workspace} Workspace.',
        status: 'Deleted',
        statusIcon: '🗑',
        facts: [{ name: 'Status', value: '🗑 Deleted' }],
        ctaText: 'Go to Deployments',
        ctaUrl: '/deployments'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const TrainingTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{userName} created a new Training - {name}.',
        body: 'New training created in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    COMPLETED: {
        subject: 'Training {name} completed successfully.',
        body: 'Training {name} completed successfully in {workspace} Workspace.',
        status: 'Completed',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Completed' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    FAILED: {
        subject: 'Training {name} failed.',
        body: 'Training {name} failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    STARTED: {
        subject: 'Training {name} started.',
        body: 'Training {name} started in {workspace} Workspace.',
        status: 'Started',
        statusIcon: '▶',
        facts: [{ name: 'Status', value: '▶ Started' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    DATASET_FAILED: {
        subject: 'Training {name} failed - dataset download failed.',
        body: 'Training {name} failed because dataset download failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }, { name: 'Reason', value: 'Dataset download failed' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING WEIGHTS TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const TrainingWeightsTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{userName} initiated Training Weights export for {name}.',
        body: 'Training Weights export initiated for {name} in {workspace} Workspace.',
        status: 'Initiated',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Initiated' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    SUCCESS: {
        subject: 'Training Weights for {name} uploaded successfully.',
        body: 'Training Weights for {name} uploaded successfully in {workspace} Workspace.',
        status: 'Uploaded',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Uploaded' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
    FAILED: {
        subject: 'Training Weights for {name} failed to upload.',
        body: 'Training Weights for {name} failed to upload in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Training',
        ctaUrl: '/training'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARKING TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const BenchmarkingTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{name} Benchmarking created successfully.',
        body: 'New benchmarking created in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Benchmarking',
        ctaUrl: '/benchmarking'
    },
    COMPLETED: {
        subject: '{name} Benchmarking completed successfully.',
        body: 'Benchmarking {name} completed successfully in {workspace} Workspace.',
        status: 'Completed',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Completed' }],
        ctaText: 'Go to Benchmarking',
        ctaUrl: '/benchmarking'
    },
    FAILED: {
        subject: '{name} Benchmarking failed.',
        body: 'Benchmarking {name} failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Benchmarking',
        ctaUrl: '/benchmarking'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// BATCH INFERENCE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const BatchInferenceTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: 'Batch inference "{name}" created.',
        body: 'Batch inference "{name}" created. Initial job is now processing in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Processing' }],
        ctaText: 'Go to Batch Inference',
        ctaUrl: '/batch-inference'
    },
    QUEUED: {
        subject: 'Batch inference "{name}" queued.',
        body: 'Batch inference "{name}" is queued waiting for dataset download in {workspace} Workspace.',
        status: 'Queued',
        statusIcon: '⏳',
        facts: [{ name: 'Status', value: '⏳ Queued' }],
        ctaText: 'Go to Batch Inference',
        ctaUrl: '/batch-inference'
    },
    DATASET_FAILED: {
        subject: 'Batch inference "{name}" - dataset download failed.',
        body: 'Batch inference "{name}" created, but dataset download failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Dataset Failed' }],
        ctaText: 'Go to Batch Inference',
        ctaUrl: '/batch-inference'
    },
    COMPLETED: {
        subject: 'Batch inference job "{name}" completed successfully.',
        body: 'Batch inference job "{name}" completed successfully in {workspace} Workspace.',
        status: 'Completed',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Completed' }],
        ctaText: 'Go to Batch Inference',
        ctaUrl: '/batch-inference'
    },
    FAILED: {
        subject: 'Batch inference job "{name}" failed.',
        body: 'Batch inference job "{name}" failed in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Batch Inference',
        ctaUrl: '/batch-inference'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE (RAG) TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const KnowledgeBaseTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{userName} created a new Knowledge Base - {name}.',
        body: '{userName} created a new Knowledge Base in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Knowledge Base',
        ctaUrl: '/knowledge-base'
    },
    READY: {
        subject: 'Knowledge Base "{name}" is ready.',
        body: 'Knowledge Base "{name}" is ready in {workspace} Workspace.',
        status: 'Ready',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Ready' }],
        ctaText: 'Go to Knowledge Base',
        ctaUrl: '/knowledge-base'
    },
    FAILED: {
        subject: 'Knowledge Base "{name}" failed.',
        body: 'Knowledge Base "{name}" failed to process in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Knowledge Base',
        ctaUrl: '/knowledge-base'
    },
    SYNCING: {
        subject: 'Knowledge Base "{name}" is syncing.',
        body: 'Knowledge Base "{name}" is syncing in {workspace} Workspace.',
        status: 'Syncing',
        statusIcon: '🔄',
        facts: [{ name: 'Status', value: '🔄 Syncing' }],
        ctaText: 'Go to Knowledge Base',
        ctaUrl: '/knowledge-base'
    },
    SOURCE_ADDED: {
        subject: '{userName} added a new source to Knowledge Base: {name}.',
        body: '{userName} added a new source to Knowledge Base: {name} in {workspace} Workspace.',
        status: 'Source Added',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Source Added' }],
        ctaText: 'Go to Knowledge Base',
        ctaUrl: '/knowledge-base'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// MY MODEL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const MyModelTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{userName} created a new AI Model - {name}.',
        body: '{userName} created a new AI Model in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to My Models',
        ctaUrl: '/my-model'
    },
    COMPILED: {
        subject: 'AI Model {name} compiled successfully.',
        body: 'AI Model {name} compiled successfully in {workspace} Workspace.',
        status: 'Compiled',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Compiled' }],
        ctaText: 'Go to My Models',
        ctaUrl: '/my-model'
    },
    FAILED: {
        subject: 'AI Model {name} failed to compile.',
        body: 'AI Model {name} failed to compile in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to My Models',
        ctaUrl: '/my-model'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// DATASET TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const DatasetTemplates: Record<string, WebhookTemplate> = {
    CREATED: {
        subject: '{userName} created a new Dataset.',
        body: '{userName} created a new Dataset in {workspace} Workspace.',
        status: 'Created',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Created' }],
        ctaText: 'Go to Datasets',
        ctaUrl: '/datasets'
    },
    SUCCESS: {
        subject: 'Dataset {name} uploaded successfully.',
        body: 'Dataset {name} uploaded successfully in {workspace} Workspace.',
        status: 'Uploaded',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Uploaded' }],
        ctaText: 'Go to Datasets',
        ctaUrl: '/datasets'
    },
    FAILED: {
        subject: 'Dataset {name} failed to upload.',
        body: 'Dataset {name} failed to upload in {workspace} Workspace.',
        status: 'Failed',
        statusIcon: '❌',
        facts: [{ name: 'Status', value: '❌ Failed' }],
        ctaText: 'Go to Datasets',
        ctaUrl: '/datasets'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// CREDIT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const CreditTemplates: Record<string, WebhookTemplate> = {
    ADDED: {
        subject: 'Account has been successfully credited by {amount}.',
        body: 'Account has been credited in {workspace} Workspace.',
        status: 'Credited',
        statusIcon: '✅',
        facts: [],
        ctaText: 'Go to Billing',
        ctaUrl: '/settings?tab=billing'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// INVITE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const InviteTemplates: Record<string, WebhookTemplate> = {
    SENT: {
        subject: '{invitee} member invited by {userName}.',
        body: 'Member invited by {userName} in {workspace} Workspace.',
        status: 'Invited',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Invited' }],
        ctaText: 'Go to Access Management',
        ctaUrl: '/settings?tab=access-management'
    },
    ACCEPTED: {
        subject: '{invitee} accepted the invitation to join {workspace} Workspace.',
        body: 'Member invited by {userName} in {workspace} Workspace.',
        status: 'Invitation Accepted',
        statusIcon: '✅',
        facts: [{ name: 'Status', value: '✅ Invitation Accepted' }],
        ctaText: 'Go to Access Management',
        ctaUrl: '/settings?tab=access-management'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET BREACH TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const BudgetBreachTemplates: Record<string, WebhookTemplate> = {
    EXCEEDED: {
        subject: '{period} Budget limit exceeded.',
        body: '{period} budget reached 100% limit in {workspace} Workspace.',
        status: 'Exceeded',
        statusIcon: '🚨',
        facts: [
            { name: 'Threshold level', value: '100%' },
            { name: 'Spent', value: '{totalSpent}' },
            { name: 'Total Budget', value: '{budget}' },
        ],
        ctaText: 'Go to Billing',
        ctaUrl: '/settings?tab=billing'
    },
    THRESHOLD: {
        subject: '{period} Budget threshold crossed.',
        body: '{period} budget at {percentage}% in {workspace} Workspace.',
        status: 'Warning',
        statusIcon: '⚠️',
        facts: [
            { name: 'Threshold level', value: '{percentage}%' },
            { name: 'Spent', value: '{totalSpent}' },
            { name: 'Total Budget', value: '{budget}' },
        ],
        ctaText: 'Go to Billing',
        ctaUrl: '/settings?tab=billing'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// QUOTA TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

const QuotaTemplates: Record<string, WebhookTemplate> = {
    REACHED: {
        subject: 'Quota {quota_type} limit reached.',
        body: 'Quota {quota_type} limit reached in {workspace} Workspace.',
        status: 'Limit Reached',
        statusIcon: '🚨',
        facts: [
            { name: 'Spent', value: '{used}' },
            { name: 'Limit', value: '{limit}' },
        ],
        ctaText: 'Go to Quota',
        ctaUrl: '/settings?tab=quota'
    },
    REQUEST: {
        subject: 'Quota {quota_type} request raised by {userName}.',
        body: 'Quota request raised in {workspace} Workspace.',
        status: 'Request Raised',
        statusIcon: '✅',
        facts: [
            { name: 'Value', value: '{request_for}' },
        ],
        ctaText: 'Go to Quota',
        ctaUrl: '/settings?tab=quota'
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

const TemplateRegistry: Record<string, Record<string, WebhookTemplate>> = {
    Deployment: DeploymentTemplates,
    Training: TrainingTemplates,
    TrainingWeights: TrainingWeightsTemplates,
    Benchmarking: BenchmarkingTemplates,
    BatchInference: BatchInferenceTemplates,
    Rag: KnowledgeBaseTemplates,
    Mymodel: MyModelTemplates,
    Dataset: DatasetTemplates,
    Credit: CreditTemplates,
    Invite: InviteTemplates,
    BUDGET_BREACH: BudgetBreachTemplates,
    QUOTA_REACHED: QuotaTemplates,
    Quota: QuotaTemplates,
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interpolates {placeholder} variables in a string.
 */
export function interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : match;
    });
}

/**
 * Gets a webhook template by module and action, with variables interpolated.
 * Returns null if no template found for the given module/action.
 */
export function getWebhookTemplate(
    module: string,
    action: string,
    variables: WebhookTemplateVariables = {}
): { subject: string; body: string; facts: WebhookFact[]; ctaText: string; ctaUrl: string; status: string } | null {
    const moduleTemplates = TemplateRegistry[module];
    if (!moduleTemplates) return null;

    const template = moduleTemplates[action.toUpperCase()];
    if (!template) return null;

    const subject = interpolate(template.subject, variables);
    const body = interpolate(template.body, variables);
    const ctaText = template.ctaText || '';
    const ctaUrl = template.ctaUrl || '';
    const status = template.status || '';

    const facts = (template.facts || []).map(f => ({
        name: f.name,
        value: interpolate(f.value, variables)
    }));

    return { subject, body, facts, ctaText, ctaUrl, status };
}

/**
 * Gets a fallback template when no specific action template exists.
 * Uses the module name + raw title/text as a generic alert.
 */
export function getFallbackTemplate(
    module: string,
    title: string,
    text: string,
    facts: WebhookFact[] = []
): { subject: string; body: string; facts: WebhookFact[]; ctaText: string; ctaUrl: string; status: string } {
    return {
        subject: title,
        body: text,
        facts,
        ctaText: '',
        ctaUrl: '',
        status: ''
    };
}
