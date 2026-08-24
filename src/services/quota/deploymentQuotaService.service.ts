import { AwsService } from "../../core/AwsService";
import { FileObject } from "../../core/FileModel";
import Database from "../../database/database";
import { CompanyEntity } from "../../entities/companyEntity";
import { DeploymentQuotaDto } from "../../database/repository/quota/deploymentQuota.dto";
import { DeploymentQuotaModel } from "../../database/repository/quota/deploymentQuota.model";
import { DeploymentQuotaEntity } from "../../entities/deploymentQuotaEntity";
import { BaseServices } from "../baseService.services";
import { QuotaStatus, ModuleTypeQuota } from "../../config";
import AuditLogService from "../auditLog/auditLogService.services";
import WebhookService from "../webhook/webhookService.services";

class DeploymentQuotaService extends BaseServices {
    constructor(entity: any = DeploymentQuotaEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): DeploymentQuotaModel {
        return new DeploymentQuotaModel();
    }

    getDTO() {
        return DeploymentQuotaDto;
    }

    getModuleName(): string {
        return 'Quota';
    }

    override createPreProcess(model: DeploymentQuotaModel, files: FileObject[] | null): Promise<DeploymentQuotaModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                model.status = model.status || QuotaStatus.PENDING;
                model.requested_by = model.decryptToken?.member_id || model.requested_by;
                model.request_for = model.request_for;
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-------DeploymentQuotaService createPreProcess error---------', error);
                reject(error)
            }
        });
    }

    override async createPostProcess(result: DeploymentQuotaModel, model: DeploymentQuotaModel, files: any): Promise<DeploymentQuotaModel> {
        try {
            if (model.id) {
                // It's an update
                let desc = `Quota updated for ${result.module_type}`;
                if (result.status === QuotaStatus.APPROVED) {
                    desc = `Increase TPM/RPM Limit approved - TPM: ${result.extended_tpm_limit || result.tpm_limit}, RPM: ${result.extended_rpm_limit || result.rpm_limit}`;
                }

                await AuditLogService.log({
                    company_id: result.company_id,
                    member_id: model.decryptToken?.member_id || result.requested_by,
                    module: this.getModuleName(),
                    action: 'UPDATE',
                    entity_type: 'DeploymentQuotaEntity',
                    entity_id: result.id,
                    entity_name: `Quota-${result.id}`,
                    description: desc,
                    ip_address: '',
                });
            } else {
                if (result.is_default !== 1) {
                    try {
                        const webhookService = new WebhookService();
                        const quotaCompany = await CompanyEntity.findOneBy({ id: result.company_id, is_delete: 0 });
                        webhookService.dispatchTemplatedAlert(result.company_id, 'Quota', 'REQUEST', {
                            quota_type: result.request_for,
                            request_for: result.request_for,
                            userName: '',
                            workspace: quotaCompany ? (quotaCompany as any).company_name : '',
                        }).catch(webhookErr => {
                            console.error('Error sending QUOTA_REQUEST_RAISED webhook:', webhookErr);
                        });
                    } catch (webhookErr) {
                        console.error('Error sending QUOTA_REQUEST_RAISED webhook:', webhookErr);
                    }

                    await AuditLogService.log({
                        company_id: result.company_id,
                        member_id: model.decryptToken?.member_id || result.requested_by,
                        module: this.getModuleName(),
                        action: 'CREATE',
                        entity_type: 'DeploymentQuotaEntity',
                        entity_id: result.id,
                        entity_name: `Quota-${result.id}`,
                        description: `Quota request created for ${result.module_type}`,
                        ip_address: '',
                    });
                }
            }
            return result;
        } catch (error) {
            console.error('-------DeploymentQuotaService createPostProcess error---------', error);
            throw error;
        }
    }

    async prepareQuery(param: any): Promise<any> {
        try {
            const db = Database.getInstance();
            let query = ``;

            if (param.status !== 'Pending') {
                query = `
                    SELECT
                        dq.model_id,
                        dq.id AS quota_id,
                        dq.max_tpm_limit,
                        dq.max_rpm_limit,
                        dq.module_type,
                        m.model_rank,
                        COALESCE(ia.deployment_name, m.name) AS model_name,
                        m.model_provider_id,
                        CASE WHEN LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}' THEN NULL ELSE mp.model_provider_icon END AS model_image,
                        mp.model_provider_icon AS provider_icon,
                        CASE
                            WHEN dq.company_id = ${param.company_id}
                                AND dq.extended_tpm_limit > 0
                                AND dq.status = 'Approved'
                            THEN dq.extended_tpm_limit
                            ELSE dq.tpm_limit
                        END AS tpm_limit,

                        CASE
                            WHEN dq.company_id = ${param.company_id}
                                AND dq.extended_rpm_limit > 0
                                AND dq.status = 'Approved'
                            THEN dq.extended_rpm_limit
                            ELSE dq.rpm_limit
                        END AS rpm_limit,

                        COALESCE(SUM(dqu.tpm_used), 0) AS tpm_used,
                        COALESCE(SUM(dqu.rpm_used), 0) AS rpm_used

                    FROM v0_dev_yotta.deployment_quota dq
                    LEFT JOIN infra_schema.infra_allocation ia ON ia.id = dq.model_id AND LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}'
                    LEFT JOIN model.model m ON m.id = (CASE WHEN LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}' THEN ia.module_id ELSE dq.model_id END) AND m.is_delete = 0
                    LEFT JOIN v0_dev_yotta.deployment_quota_usage dqu ON dqu.model_id = dq.model_id AND dqu.company_id = ${param.company_id} AND dqu.is_delete = 0 AND dqu.minute_bucket >= NOW() - INTERVAL '60 seconds'
                    LEFT JOIN model.model_provider mp ON m.model_provider_id = mp.id AND mp.is_delete = 0

                    WHERE dq.is_delete = 0
                    AND (dq.company_id = ${param.company_id} OR (dq.is_default = 1 AND dq.company_id IS NULL))
                    AND NOT (dq.is_default = 0 AND dq.status = 'Pending')
                    ${param.module_type ? `AND LOWER(dq.module_type) = LOWER('${param.module_type}')` : ''}
                    -- ensure deployment is active and belongs to company
                    AND (
                        LOWER(dq.module_type) != '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}'
                        OR (ia.id IS NOT NULL AND ia.company_id = ${param.company_id} AND ia.is_delete = 0)
                    )

                    -- hide default when company approved exists
                    AND NOT (
                        dq.is_default = 1
                        AND EXISTS (
                            SELECT 1
                            FROM v0_dev_yotta.deployment_quota dq2
                            WHERE dq2.model_id = dq.model_id
                            AND dq2.company_id = ${param.company_id}
                            AND dq2.is_default = 0
                            AND dq2.status = 'Approved'
                            AND dq2.is_delete = 0
                            AND LOWER(dq2.module_type) = LOWER(dq.module_type)
                        )
                    )
                    -- restrict playground to global models only
                    AND (
                        LOWER(dq.module_type) != '${ModuleTypeQuota.PLAYGROUND.toLowerCase()}'
                        OR EXISTS (
                            SELECT 1 FROM v0_dev_yotta.deployment_quota dq_base
                            WHERE dq_base.model_id = dq.model_id
                            AND dq_base.is_default = 1
                            AND dq_base.company_id IS NULL
                            AND LOWER(dq_base.module_type) = '${ModuleTypeQuota.PLAYGROUND.toLowerCase()}'
                            AND dq_base.is_delete = 0
                        )
                    )
                    AND m.is_delete = 0
                    -- pick only latest company-approved row
                    AND (
                        dq.is_default = 1
                        OR dq.id = (
                            SELECT MAX(dq3.id)
                            FROM v0_dev_yotta.deployment_quota dq3
                            WHERE dq3.model_id = dq.model_id
                            AND dq3.company_id = ${param.company_id}
                            AND dq3.is_default = 0
                            AND dq3.status = 'Approved'
                            AND dq3.is_delete = 0
                            AND LOWER(dq3.module_type) = LOWER(dq.module_type)
                        )
                    )

                    GROUP BY
                        dq.model_id,
                        dq.id,
                        m.name,
                        m.model_provider_id,
                        mp.model_provider_icon,
                        dq.company_id,
                        dq.extended_tpm_limit,
                        dq.extended_rpm_limit,
                        dq.status,
                        dq.tpm_limit,
                        dq.rpm_limit,
                        m.model_rank,
                        dq.module_type,
                        ia.deployment_name

                    ORDER BY m.model_rank ASC;
                `;

            }
            else {
                // Pending logic unchanged
                query = `
                    SELECT
                        dq.*,
                        COALESCE(ia.deployment_name, m.name) AS model_name,
                        m.model_rank,
                        m.model_provider_id,
                        CASE WHEN LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}' THEN NULL ELSE mp.model_provider_icon END AS model_image,
                        mp.model_provider_icon AS provider_icon,
                        mem.profile_picture,
                        mem.full_name AS requested_by_name

                    FROM v0_dev_yotta.deployment_quota dq
                    LEFT JOIN infra_schema.infra_allocation ia ON ia.id = dq.model_id AND LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}'
                    LEFT JOIN model.model m ON m.id = (CASE WHEN LOWER(dq.module_type) = '${ModuleTypeQuota.DEPLOYMENT.toLowerCase()}' THEN ia.module_id ELSE dq.model_id END) AND m.is_delete = 0
                    LEFT JOIN model.model_provider mp ON m.model_provider_id = mp.id AND mp.is_delete = 0
                    LEFT JOIN v0_dev_yotta.members mem ON mem.id = dq.requested_by AND mem.is_delete = 0

                    WHERE dq.is_delete = 0
                    ${param.module_type ? `AND dq.module_type = '${param.module_type}'` : ''}
                    AND dq.company_id = ${param.company_id}
                    AND is_default = 0
                    --AND dq.status = 'Pending'

                    ORDER BY dq.id DESC;
                `;
            }

            const result = await db.executeExternalQuery(query);

            if (result.length > 0) {
                for (const row of result) {

                    // model image signed url
                    if (row.provider_icon || row.model_image) {
                        const modelImage = row.provider_icon || row.model_image;
                        if (!modelImage || modelImage.trim() === "") {
                            row.model_image_url = null;
                        }
                        else if (modelImage.startsWith("http://") || modelImage.startsWith("https://")) {
                            row.model_image_url = modelImage;
                        }
                        else {
                            try {
                                const signedUrl = await this.generateSignedUrl(
                                    "modelProviderMedia",
                                    row.model_provider_id,
                                    modelImage
                                );
                                row.model_image_url = signedUrl;
                            } catch {
                                row.model_image_url = null;
                            }
                        }
                    }

                    // profile picture signed url (pending case)
                    if (row.profile_picture) {
                        const profilePic = row.profile_picture;
                        if (!profilePic || profilePic.trim() === "") {
                            row.profile_picture_url = null;
                        }
                        else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                            row.profile_picture_url = profilePic;
                        }
                        else {
                            try {
                                const signedUrl = await this.generateSignedUrl(
                                    "members",
                                    row.requested_by,
                                    profilePic
                                );
                                row.profile_picture_url = signedUrl;
                            } catch {
                                row.profile_picture_url = null;
                            }
                        }
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Error fetching Quota:', error);
            throw error;
        }
    }

    async deleteQuotaByModelId(modelId: number): Promise<void> {
        try {
            await this.entity.createQueryBuilder()
                .update(this.entity)
                .set({ is_delete: 1 })
                .where("model_id = :modelId", { modelId })
                .andWhere(`module_type = '${ModuleTypeQuota.DEPLOYMENT}'`)
                .execute();
        } catch (error) {
            console.error('Error deleting Quota by modelId:', error);
            throw error;
        }
    }

}

export default DeploymentQuotaService;