import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { ChatEntity } from '../../entities/chatEntity';
import { ChatModel } from '../../database/repository/chat/chat.model';
import { ChatDto } from '../../database/repository/chat/chat.dto';

class ChatService extends BaseServices {
    constructor(entity: any = ChatEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ChatModel {
        return new ChatModel();
    }

    getDTO() {
        return ChatDto;
    }

    getModuleName(): string {
        return 'Chat Session';
    }
}

export default ChatService;
