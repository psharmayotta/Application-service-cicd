export const ErrorCodes = {
    E10001: {
        type: 'generic',
        message: 'The requested resource was not found.',
        status: 404
    },
    E10002: {
        type: 'generic',
        message: 'You are not authorized to perform this action.',
        status: 401
    },
    E10003: {
        type: 'generic',
        message: 'Access to this resource is forbidden.',
        status: 403
    },
    E10004: {
        type: 'generic',
        message: 'The data provided did not pass validation.',
        status: 400
    },
    E10005: {
        type: 'generic',
        message: 'An unexpected error occurred on the server.',
        status: 500
    },
    E10006: {
        type: 'generic',
        message: 'The request could not be understood by the server.',
        status: 400
    },
    E10007: {
        type: 'generic',
        message: 'There is a conflict with the current state of the resource.',
        status: 409
    },
    E10008: {
        type: 'generic',
        message: 'This feature is not implemented yet.',
        status: 501
    },
    E10009: {
        type: 'generic',
        message: 'The service is currently unavailable.',
        status: 503
    },
    E10010: {
        type: 'generic',
        message: 'The server timed out waiting for the request.',
        status: 408
    },
    E10011: {
        type: 'APIKeyName Unique',
        message: 'A token with this name already exists in the organization. Name should be Unique.',
        status: 400
    },
    // Add more error codes as needed
    E10012: {
        type: 'generic',
        message: 'Token generation limit reached. Maximum 4 API keys allowed per user.',
        status: 400
    },
    E10013: {
        type: 'CompanyName Unique',
        message: 'A company with this name already exists. Company name should be unique.',
        status: 400
    },

    E10014: {
        type: 'EmailExists',
        message: 'An account with this email address already exists.',
        status: 400
    },

    E10015: {
        type: 'EmailNotFound',
        message: 'Email address not found.',
        status: 400
    },
    E10016: {
        type: 'AccountDeactivated',
        message: 'Account has been deactivated.',
        status: 400
    },
    E10017: {
        type: 'InvalidResetLink',
        message: 'The reset link is invalid or has expired.',
        status: 400
    },
    E10018: {
        type: 'InvalidInviteLink',
        message: 'The invite link is invalid or has expired.',
        status: 400
    },
    E10019: {
        type: 'APIKeyExists',
        message: 'API key already exists and should be unique.',
        status: 400
    },
    E10020: {
        type: 'company',
        message: 'Company Id is required',
        status: 400
    },
    E10021: {
        type: 'datevalidation',
        message: 'start date and end date is required',
        status: 400
    },
    E10022: {
        type: 'models',
        message: 'Please select atleast one model. Model is required',
        status: 400
    },
    E10023: {
        type: 'logout',
        message: 'Please Provide a valid Id or api_access_token',
        status: 400
    },
    E10024: {
        type: 'HuggingFaceRepoVerification',
        message: 'Repository verification failed.',
        status: 400
    },
    E10025: {
        type: 'domainNameExist',
        message: 'Domain name already exists.',
        status: 400
    },
    E10026: {
        type: 'subdomain',
        message: 'Subdomain name already exists',
        status: 400
    },
    E10027: {
        type: 'cloudProviderId',
        message: 'Cloud Provider Id is required',
        status: 400
    },
    E10028: {
        type: 'cloudAccountNameExist',
        message: 'Cloud account with name already exists for this organisation',
        status: 400
    },
    E10029: {
        type: 'modelNotFound',
        message: 'Model not found',
        status: 404
    },
    E10031: {
        type: 'SecretTagged',
        message: 'This cloud secret is already associated with another account',
        status: 400
    },
    E10032: {
        type: 'UnableToGetMember',
        message: 'Unable to retrieve member information',
        status: 400
    },
    E10035: {
        type: 'HardwareValidation',
        message: 'Hardware id is required',
        status: 400
    },
    E10036: {
        type: 'ModuleId',
        message: 'Module id is required',
        status: 400
    },
    E10037: {
        type: 'clusterId',
        message: 'Cluster id is required',
        status: 400
    },
    E10038: {
        type: 'AssignedCore',
        message: 'Accelerator count is required',
        status: 400
    },
    E10039: {
        type: 'TrainingNameExists',
        message: 'Training with the same name already exists',
        status: 400,
    },
    E10040: {
        type: 'CreatePreProcessError',
        message: 'Unexpected error in preprocessing',
        status: 400,
    },
    E10041: {
        type: 'presetFilter',
        message: 'Please pass the correct preset filter',
        status: 400,
    },
    E10042: {
        type: 'modelNameExist',
        message: 'Model Name Already Exist',
        status: 404
    },
    E10043: {
        type: 'ModelStatusUpdateError',
        message: 'Error while updating model status',
        status: 404
    },
    E10044: {
        type: 'modelTrainingApiFailure',
        message: 'Error In model Training Api',
        status: 500
    },
    E10045: {
        type: 'traininglNameExist',
        message: 'Training Name Already Exist',
        status: 400
    },
    E10046: {
        type: 'walletIdMissing',
        message: 'Wallet ID is required',
        status: 400
    },
    E10047: {
        type: 'InvalidMemberId',
        message: 'Invalid Member ID',
        status: 400
    },
    E10048: {
        type: 'IncorrectOldPassword',
        message: 'Entered old password is incorrect',
        status: 400
    },
    E10049: {
        type: 'CompanyNotDeleted',
        message: 'At least one company must exist for this user',
        status: 400
    },
    E10050: {
        type: 'UserIdAlreadyExist',
        message: 'User ID is already associated with another account',
        status: 400
    },
    E10051: {
        type: 'OrganisationNotExists',
        message: 'Organisation does not exists',
        status: 400
    },
    E10052: {
        type: 'NotificationId',
        message: 'Notification Id is required',
        status: 400
    },
    E10053: {
        type: 'CompanyCannotBeDeleted',
        message: 'Company cannot be deleted',
        status: 400
    },
    E10054: {
        type: 'LoginFailed',
        message: 'Login failed. You are not associated with any active company or your approval is pending.',
        status: 400
    },
    E10055: {
        type: 'PendingRequestNotFound',
        message: 'Pending request not found',
        status: 404
    },
    E10056: {
        type: 'UnauthorizedCompanyAdmin',
        message: 'You are not authorized to approve/reject requests for this company',
        status: 403
    },
    E10057: {
        type: 'OrgenizationAlreadyExists',
        message: 'Organization already exists',
        status: 400
    },
    E10058: {
        type: 'InviteAlreadyExists',
        message: 'User already exists',
        status: 400
    },
    E10059: {
        type: 'SecretAlreadyExists',
        message: 'Secret is already exists',
        status: 400
    },
    E10060: {
        type: 'HostedZoneAlreadyExists',
        message: 'Hosted zone is already exists',
        status: 400
    },
    E10061: {
        type: 'CloudAccountAlreadyExists',
        message: 'Cloud account is already exists',
        status: 400
    },
    E10062: {
        type: 'DeploymentNotFound',
        message: 'Deployment not found',
        status: 404
    },
    E10063: {
        type: 'BenchmarkingId',
        message: 'Benchmarking Id is required',
        status: 400
    },
    E10064: {
        type: 'BenchmarkingNotFound',
        message: 'Benchmarking not found',
        status: 404
    },
    E10065: {
        type: 'KnowledgeBaseNotFound',
        message: 'Knowledge Base ID does not exist or you do not have permission',
        status: 404
    },
    // Yotta One Integration Error Codes
    E10066: {
        type: 'YottaOneUserEmailRequired',
        message: 'User email is required for Yotta One integration',
        status: 400
    },
    E10067: {
        type: 'YottaOneOrgNameRequired',
        message: 'Organization name is required for Yotta One integration',
        status: 400
    },
    E10068: {
        type: 'YottaOneExternalCustomerIdRequired',
        message: 'external_customer_id is required',
        status: 400
    },
    E10069: {
        type: 'YottaOneOrgNotFound',
        message: 'No organization found with the given external_customer_id',
        status: 404
    },
    E10071: {
        type: 'YottaOneEmailAlreadyExists',
        message: 'A member with this email already exists',
        status: 400
    },
    E10072: {
        type: 'DatasetIdRequired',
        message: 'Dataset Id is required',
        status: 400
    },
    E10073: {
        type: 'DatasetNotFound',
        message: 'Dataset not found',
        status: 404
    },
    E10074: {
        type: 'OrganisationWalletNotFound',
        message: 'No wallet was found for this organization',
        status: 404
    },
    E10075: {
        type: 'CostForecastNotFound',
        message: 'No cost forecast data is available for this organization',
        status: 404
    },
    E10076: {
        type: 'CostForecastUnavailable',
        message: 'The cost forecast service is currently unavailable',
        status: 503
    }
};
