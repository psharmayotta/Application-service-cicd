import { AwsService } from "../../core/AwsService";
import { DeploymentQuotaDto } from "../../database/repository/quota/deploymentQuota.dto";
import { DeploymentQuotaModel } from "../../database/repository/quota/deploymentQuota.model";
import { ChatEntity } from "../../entities/chatEntity";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { DeploymentQuotaEntity } from "../../entities/deploymentQuotaEntity";
import { DeploymentQuotaUsageEntity } from "../../entities/deploymentQuotaUsageEntity";
import { BaseServices } from "../baseService.services";

class DeploymentQuotaUsageService extends BaseServices {
    constructor(entity: any = DeploymentQuotaUsageEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): DeploymentQuotaModel {
        return new DeploymentQuotaModel();
    }

    getDTO() {
        return DeploymentQuotaDto;
    }

    async validateAndConsumeRPM(model_id: number, company_id: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const minuteBucket = new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    new Date().getDate(),
                    new Date().getHours(),
                    new Date().getMinutes(),
                    0,
                    0
                );

                const quota = await DeploymentQuotaEntity.findOne({
                    where: {
                        model_id: model_id,
                        is_delete: 0,
                    },
                });

                if (!quota || quota.rpm_limit == null) {
                    return reject("RPM quota not configured for this task")
                }

                let rpmLimit = quota.rpm_limit;

                if (
                    quota.company_id === company_id &&
                    quota.extended_rpm_limit &&
                    quota.extended_rpm_limit > 0 &&
                    quota.status === 'Approved'
                ) {
                    rpmLimit = quota.extended_rpm_limit;
                }
                const usage = await this.entity
                    .createQueryBuilder("qu")
                    .where("qu.model_id = :model_id", { model_id })
                    .andWhere("qu.minute_bucket = :minuteBucket", { minuteBucket })
                    .andWhere("qu.company_id = :company_id", { company_id })
                    .andWhere("qu.is_delete = 0")
                    .getOne();

                const rpmUsed = usage ? usage.rpm_used : 0;

                if (rpmUsed >= rpmLimit) {
                    return reject(`E10052`)
                }

                if (usage) {
                    usage.rpm_used += 1;
                    usage.modified_at = new Date();
                    await this.entity.save(usage);
                } else {
                    const newUsage = this.entity.create({
                        model_id,
                        company_id,
                        minute_bucket: minuteBucket,
                        rpm_used: 1,
                        tpm_used: 0,
                        created_at: new Date(),
                    });
                    await this.entity.save(newUsage);
                    return resolve()
                }
                return resolve()
            } catch (error) {
                return reject(error);
            }
        });
    }

    async consumeTPM(chatId: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                const session = await ChatSessionEntity.findOne({
                    where: { session_id: chatId, is_delete: 0 },
                    order: { created_at: 'DESC' },
                });

                if (!session) return resolve();

                const chat = await ChatEntity.findOne({
                    where: { chat_session_id: session.id, is_delete: 0 },
                    order: { created_at: 'DESC' },
                });

                if (!chat) return resolve();

                const inputTokens = chat.input_word_count || 0;
                const outputTokens = chat.output_word_count || 0;
                const totalTokens = inputTokens + outputTokens;

                if (totalTokens === 0) return resolve();

                const model_id = session.model_id;
                const company_id = session.company_id;

                const minuteBucket = new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    new Date().getDate(),
                    new Date().getHours(),
                    new Date().getMinutes(),
                    0,
                    0
                );

                const quota = await DeploymentQuotaEntity.findOne({
                    where: {
                        model_id: model_id,
                        is_delete: 0,
                    },
                });

                let usage = await this.entity.findOne({
                    where: {
                        model_id: model_id,
                        company_id: company_id,
                        minute_bucket: minuteBucket,
                        is_delete: 0,
                    },
                });

                const currentTPM = usage ? usage.tpm_used : 0;

                let tpmLimit = quota?.tpm_limit || 0;

                if (
                    quota &&
                    quota.company_id === company_id &&
                    quota.extended_tpm_limit &&
                    quota.extended_tpm_limit > 0 &&
                    quota.status === 'Approved'
                ) {
                    tpmLimit = quota.extended_tpm_limit;
                }

                if (tpmLimit && currentTPM + totalTokens > tpmLimit) {
                    return reject("E10051");
                }

                if (usage) {
                    usage.tpm_used = currentTPM + totalTokens;
                    usage.modified_at = new Date();
                    await this.entity.update(usage.id, usage);
                }

                return resolve();
            } catch (error) {
                return reject(error);
            }
        });
    }

}

export default DeploymentQuotaUsageService;

