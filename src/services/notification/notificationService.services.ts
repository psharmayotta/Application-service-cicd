import { BaseServices } from '../baseService.services';
import { NotificationEntity } from '../../entities/notificationEntity';
import { MembersEntity } from '../../entities/membersEntity';
import { CompanyEntity } from '../../entities/companyEntity';
import { AwsService } from '../../core/AwsService';
import { InferModel } from '../../database/repository/InferModel/InferModel.model';
import { NotificationModel } from '../../database/repository/notification/notification.model';
import { NotificationDto } from '../../database/repository/notification/notification.dto';
import { WebSocketService } from '../../utils/webSocket/webSocketService';
import { CDN_LINK, ModuleType } from '../../config';
import { Pagination } from '../../core/InferParams';

export class NotificationService extends BaseServices {
    constructor(entity: any = NotificationEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InferModel {
        return new NotificationModel();
    }

    getDTO(): any {
        return NotificationDto;
    }

    getModuleName(): string {
        return 'Notification';
    }


    async markAsRead(data: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (data.id) {
                    await this.entity.update({ id: data.id }, { is_readed: true });
                    resolve(true);
                } else {
                    reject('E10052');
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    public override getData = async (param: Pagination): Promise<any> => {
        try {
            const company_id = param.company_id;
            if (!company_id) {
                throw 'E10020';
            }

            let skip = 0;
            if (param.pageNumber > 0) {
                skip = (param.pageNumber - 1) * param.pageSize;
            }

            const query = this.entity.createQueryBuilder('notification')
                .leftJoinAndSelect(MembersEntity, 'member', 'notification.user_id = member.id')
                .select([
                    'notification.id as id',
                    'notification.user_id as user_id',
                    'notification.notification_type as notification_type',
                    'notification.module_name as module_name',
                    'notification.is_readed as is_readed',
                    'notification.company_id as company_id',
                    'notification.message as message',
                    'notification.created_at as created_at',
                    'member.full_name as user_name'
                ])
                .where('notification.company_id = :company_id', { company_id })
                .andWhere('notification.is_delete = :is_delete', { is_delete: 0 })
                .orderBy('notification.created_at', 'DESC')
                .offset(skip)
                .limit(param.pageSize || 25);

            const [data, total] = await Promise.all([
                query.getRawMany(),
                query.getCount()
            ]);

            return {
                data,
                pagination: {
                    total,
                    pageSize: param.pageSize || 25,
                    pageNumber: param.pageNumber || 0
                }
            };
        } catch (e) {
            console.log('fetch error', e);
            throw e;
        }
    };

    override createPostProcess(result: NotificationModel, model: NotificationModel, files: any): Promise<NotificationModel> {
        return new Promise(async (resolve, reject) => {
            try {
                const member = await MembersEntity.findOneBy({ id: result.user_id });
                WebSocketService.pushMessageToCompany(result.company_id.toString(), {
                    module: ModuleType.NOTIFICATION,
                    entity: {
                        ...result,
                        user_name: member ? member.full_name : ''
                    }
                });

                try {
                    const WebhookService = require('../webhook/webhookService.services').WebhookService;
                    const webhookService = new WebhookService();
                    const company = await CompanyEntity.findOneBy({ id: result.company_id, is_delete: 0 });
                    const companyName = company ? (company as any).company_name : '';

                    // Map notification_type + message to actual status and icon
                    const cdnBase = `${CDN_LINK}uploads/email`;
                    let derivedStatus = result.notification_type || 'Update';
                    let iconFile = 'status-completed.svg';

                    // Refine "Updated" type by checking message content for actual status
                    if (derivedStatus === 'Updated' || derivedStatus === 'Update') {
                        const msg = (result.message || '').toLowerCase();
                        if (msg.includes('failed')) { derivedStatus = 'Failed'; iconFile = 'status-failed.svg'; }
                        else if (msg.includes('paused')) { derivedStatus = 'Paused'; iconFile = 'status-paused.svg'; }
                        else if (msg.includes('resumed')) { derivedStatus = 'Resumed'; iconFile = 'status-resumed.svg'; }
                        else if (msg.includes('started')) { derivedStatus = 'Started'; iconFile = 'status-resumed.svg'; }
                        else if (msg.includes('completed') || msg.includes('ready')) { derivedStatus = 'Completed'; iconFile = 'status-completed.svg'; }
                        else if (msg.includes('deleted')) { derivedStatus = 'Deleted'; iconFile = 'status-failed.svg'; }
                        else { derivedStatus = 'Completed'; iconFile = 'status-completed.svg'; }
                    } else if (derivedStatus === 'Failed') {
                        iconFile = 'status-failed.svg';
                    } else if (derivedStatus === 'Success' || derivedStatus === 'Completed') {
                        derivedStatus = 'Completed'; iconFile = 'status-completed.svg';
                    } else if (derivedStatus === 'Created' || derivedStatus === 'Added') {
                        iconFile = 'status-created.svg';
                    }

                    const statusValue = `<img src="${cdnBase}/${iconFile}" height="18" style="vertical-align:middle;" />`;

                    // Get CTA button based on module name
                    const ctaMap: Record<string, { text: string; url: string }> = {
                        'Deployment': { text: 'Go to Deployments', url: '/deploy' },
                        'Training': { text: 'Go to Training', url: '/training' },
                        'TrainingWeights': { text: 'Go to Training', url: '/training' },
                        'Benchmarking': { text: 'Go to Benchmarking', url: '/benchmarking' },
                        'BatchInference': { text: 'Go to Batch Inference', url: '/batch-inference' },
                        'Rag': { text: 'Go to Knowledge Base', url: '/knowledge-base' },
                        'KnowledgeBase': { text: 'Go to Knowledge Base', url: '/knowledge-base' },
                        'Mymodel': { text: 'Go to My Models', url: '/my-model' },
                        'Dataset': { text: 'Go to Datasets', url: '/datasets' },
                        'Credit': { text: 'Go to Billing', url: '/settings?tab=billing' },
                        'Invite': { text: 'Go to Access Management', url: '/settings?tab=access-management' },
                        'Quota': { text: 'Go to Quota', url: '/settings?tab=quota' },
                    };
                    const cta = ctaMap[result.module_name] || { text: '', url: '' };
                    const ctaText = cta.text;
                    const ctaUrl = cta.url;

                    // Skip status facts for Credit module (just shows message + CTA)
                    const facts = result.module_name === 'Credit' ? [] : [{ name: 'Status', value: statusValue }];

                    await webhookService.dispatchToAllPlatformsPublic(result.company_id, result.module_name, {
                        subject: result.message,
                        body: `${result.message} in ${companyName} Workspace.`,
                        facts,
                        ctaText,
                        ctaUrl,
                        status: derivedStatus
                    });
                } catch (webhookErr) {
                    console.error('Error dispatching webhook alert from notification flow:', webhookErr);
                }

                resolve(result);
            } catch (error) {
                console.error('Error in createPostProcess:', error);
                resolve(result);
            }
        });
    }
}
