import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { ChatSessionEntity } from '../../entities/chatSessionEntity';
import { ChatSessionModel } from '../../database/repository/chatSession/chatSession.model';
import { ChatSessionDto } from '../../database/repository/chatSession/chatSession.dto';
import { FileObject } from '../../core/FileModel';
import { ChatModel } from '../../database/repository/chat/chat.model';
import ChatService from '../chat/chatService.services';
import { ChatFilter } from '../../core/InferParams';
import { ChatEntity } from '../../entities/chatEntity';
import { ModelEntity } from '../../entities/modelEntity';
import AuditLogService from '../auditLog/auditLogService.services';

class ChatSessionService extends BaseServices {
    constructor(entity: any = ChatSessionEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ChatSessionModel {
        return new ChatSessionModel();
    }

    getDTO() {
        return ChatSessionDto;
    }

    getModuleName(): string {
        return 'Chat Session';
    }

    override createPreProcess(model: ChatSessionModel, files: FileObject[] | null): Promise<ChatSessionModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const apiKeyExist = await this.entity.findOneBy({ api_key: model.api_key, is_delete: 0 })
                model.id = apiKeyExist ? apiKeyExist.id : null;
                (model as any).__isNewPlaygroundSession = !apiKeyExist;
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('-----ChatSessionService createPreProcess error----', error);
                reject(error);
            }
        });
    }

    override transformModel(model: ChatSessionModel): ChatSessionModel {
        model.member_id = model.decryptToken.member_id;
        model.session_start_time = model.session_start_time ? new Date(model.session_start_time) : null;
        model.session_end_time = model.session_end_time ? new Date(model.session_end_time) : null;
        model.session_duration = model.session_start_time && model.session_end_time ? (new Date(model.session_end_time).getTime() - new Date(model.session_start_time).getTime()) / 1000 : null;
        return model;
    }

    override createPostProcess(result: ChatSessionModel, model: ChatSessionModel, files: any): Promise<ChatSessionModel> {
        return new Promise(async (resolve, reject) => {
            try {
                const chatModel = new ChatModel();
                const chatService = new ChatService();
                chatModel.chat_session_id = result.id;
                chatModel.user_message = model.user_message;
                chatModel.bot_response = model.bot_response;
                chatModel.company_id = result.company_id;
                await chatService.createRecord(chatModel, null);
                
                let modelName = 'Unknown Model';
                if (result.model_id) {
                    const aiModel = await ModelEntity.findOneBy({ id: result.model_id, is_delete: 0 });
                    if (aiModel) {
                        modelName = aiModel.name;
                    }
                }
                
                if ((model as any).__isNewPlaygroundSession) {
                    await AuditLogService.log({
                        company_id: result.company_id,
                        member_id: model.decryptToken?.member_id || result.member_id,
                        module: this.getModuleName(),
                        action: 'CREATE',
                        entity_type: 'ChatSessionEntity',
                        entity_id: result.id,
                        entity_name: `PlaygroundSession-${result.id}`,
                        description: `Used Playground with AI Model: ${modelName}`,
                        ip_address: '',
                    });
                }

                resolve(result);
            } catch (error) {
                console.log('-----ChatSessionService createPostProcess error----', error);
                reject(error);
            }
        });
    }

    override async prepareQuery(param: ChatFilter): Promise<any> {
        try {
            const record = await this.entity.createQueryBuilder('chat_session')
                .select([])
                .leftJoin(ChatEntity, 'chat', 'chat.chat_session_id = chat_session.id AND chat.is_delete = 0')
                .where('chat_session.is_delete = 0')
                .andWhere('chat_session.api_key = :api_key', { api_key: param.api_key })
            return Promise.resolve(param);
        } catch (error) {
            console.log('-----ChatSessionService prepareQuery error----', error);
            return Promise.reject(error);
        }
    }
}

export default ChatSessionService;
