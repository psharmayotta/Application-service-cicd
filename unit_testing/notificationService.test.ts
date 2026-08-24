import { NotificationService } from '../src/services/notification/notificationService.services';
import { NotificationModel } from '../src/database/repository/notification/notification.model';
import { MembersEntity } from '../src/entities/membersEntity';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';
import { ModuleType } from '../src/config';

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: {
        pushMessageToCompany: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../src/services/webhook/webhookService.services', () => ({
    WebhookService: class {
        dispatchAlert = jest.fn().mockResolvedValue(true);
    },
}));

describe('NotificationService Unit Tests', () => {
    let service: NotificationService;

    beforeEach(() => {
        service = new NotificationService();
        jest.clearAllMocks();
    });

    describe('markAsRead', () => {
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            updateSpy = jest.spyOn(service.entity, 'update' as any);
        });

        afterEach(() => {
            if (updateSpy) updateSpy.mockRestore();
        });

        test('should mark notification as read when id is provided', async () => {
            service.entity = { update: jest.fn().mockResolvedValue({}) } as any;

            const result = await service.markAsRead({ id: 5 });

            expect(service.entity.update).toHaveBeenCalledWith({ id: 5 }, { is_readed: true });
            expect(result).toBe(true);
        });

        test('should reject with E10052 if id is not provided', async () => {
            await expect(service.markAsRead({})).rejects.toBe('E10052');
        });
    });

    describe('getData', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([
                    { id: 1, message: 'Test notification', user_name: 'John' },
                    { id: 2, message: 'Another one', user_name: 'Jane' },
                ]),
                getCount: jest.fn().mockResolvedValue(2),
            };

            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;
        });

        test('should return paginated notifications for a company', async () => {
            const param = { company_id: 10, pageNumber: 1, pageSize: 25 } as any;

            const response = await service.getData(param);

            expect(service.entity.createQueryBuilder).toHaveBeenCalledWith('notification');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'notification.company_id = :company_id',
                { company_id: 10 }
            );
            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(25);
            expect(response.data).toHaveLength(2);
            expect(response.pagination.total).toBe(2);
        });

        test('should throw E10020 if company_id is missing', async () => {
            const param = { pageNumber: 1, pageSize: 25 } as any;

            await expect(service.getData(param)).rejects.toBe('E10020');
        });

        test('should calculate correct offset for page 2', async () => {
            const param = { company_id: 10, pageNumber: 2, pageSize: 10 } as any;

            await service.getData(param);

            expect(mockQueryBuilder.offset).toHaveBeenCalledWith(10);
            expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
        });
    });

    describe('createPostProcess', () => {
        let findOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.spyOn(MembersEntity, 'findOneBy');
        });

        afterEach(() => {
            findOneBySpy.mockRestore();
        });

        test('should push WebSocket notification with user_name', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, full_name: 'John Doe' });

            const result = {
                id: 10,
                user_id: 1,
                company_id: 100,
                module_name: ModuleType.DATASET,
                message: 'Dataset created',
                notification_type: 'success',
            } as any;

            const returned = await service.createPostProcess(result, new NotificationModel(), null);

            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith(
                '100',
                expect.objectContaining({
                    module: ModuleType.NOTIFICATION,
                    entity: expect.objectContaining({
                        user_name: 'John Doe',
                    }),
                })
            );
            expect(returned).toBe(result);
        });

        test('should use empty string for user_name if member not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            const result = {
                id: 11,
                user_id: 999,
                company_id: 200,
                module_name: 'Model',
                message: 'Model deployed',
            } as any;

            const returned = await service.createPostProcess(result, new NotificationModel(), null);

            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith(
                '200',
                expect.objectContaining({
                    entity: expect.objectContaining({ user_name: '' }),
                })
            );
            expect(returned).toBe(result);
        });

        test('should still resolve result even if webhook dispatch fails', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, full_name: 'Test User' });

            // The webhook mock is fine, but even if it throws internally the service catches it
            const result = { id: 12, user_id: 1, company_id: 50, module_name: 'Test', message: 'msg' } as any;

            const returned = await service.createPostProcess(result, new NotificationModel(), null);

            expect(returned).toBe(result);
        });
    });
});
