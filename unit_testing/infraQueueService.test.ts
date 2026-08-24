import InfraQueueService from '../src/services/infraQueue/infraQueueService.services';
import { InfraQueueModel } from '../src/database/repository/infraQueue/infraQueue.model';
import { InfraQueueEntity } from '../src/entities/infraQueueEntity';
import { InfraQueueStatus, InfraQueueModuleType, KAFKAPRODUCERS, ModelTrainingStatus } from '../src/config';
import { KafkaService } from '../src/utils/kafka/KafkaService';
import { ModelTrainingEntity } from '../src/entities/modelTrainingEntity';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';

jest.mock('../src/utils/kafka/KafkaService', () => {
    const mockKafkaInstance = {
        sendMessage: jest.fn().mockResolvedValue(true),
    };
    return {
        KafkaService: {
            getInstance: jest.fn().mockReturnValue(mockKafkaInstance),
        },
    };
});

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: {
        pushMessageToCompany: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: {
        log: jest.fn().mockResolvedValue(true),
        logFailureIncident: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../src/services/infraAvailability/infraAvailabilityService.services', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            checkAvailability: jest.fn().mockResolvedValue({ available: true }),
        })),
    };
});

describe('InfraQueueService Unit Tests', () => {
    let service: InfraQueueService;
    let mockKafkaInstance: any;

    beforeEach(() => {
        service = new InfraQueueService();
        mockKafkaInstance = KafkaService.getInstance();
        jest.clearAllMocks();
    });

    describe('addToQueue', () => {
        let saveSpy: jest.SpyInstance;

        beforeEach(() => {
            saveSpy = jest.spyOn(InfraQueueEntity, 'save' as any);
            service.entity = { save: jest.fn() } as any;
        });

        test('should save queue item with PENDING status and retry_count 0', async () => {
            const savedItem = { id: 1, status: InfraQueueStatus.PENDING, retry_count: 0 };
            service.entity.save = jest.fn().mockResolvedValue(savedItem);

            const model = new InfraQueueModel();
            model.module_type = InfraQueueModuleType.TRAINING;
            model.module_id = 100;
            model.company_id = 10;

            const result = await service.addToQueue(model);

            expect(service.entity.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: InfraQueueStatus.PENDING,
                    retry_count: 0,
                })
            );
            expect(result).toEqual(savedItem);
        });
    });

    describe('getPendingItems', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([
                    { id: 1, status: InfraQueueStatus.PENDING, priority: 10 },
                    { id: 2, status: InfraQueueStatus.PENDING, priority: 5 },
                ]),
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            } as any;
        });

        test('should query pending items ordered by priority DESC and created_at ASC', async () => {
            const items = await service.getPendingItems();

            expect(service.entity.createQueryBuilder).toHaveBeenCalledWith('queue');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'queue.status = :status',
                { status: InfraQueueStatus.PENDING }
            );
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('queue.priority', 'DESC');
            expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('queue.created_at', 'ASC');
            expect(items).toHaveLength(2);
        });

        test('should filter by acceleratorId when provided', async () => {
            await service.getPendingItems(5);

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'queue.accelerator_id = :acceleratorId',
                { acceleratorId: 5 }
            );
        });
    });

    describe('updateStatus', () => {
        let entityUpdateSpy: jest.SpyInstance;
        let findOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            findOneBySpy = jest.fn();
            service.entity = {
                update: entityUpdateSpy,
                findOneBy: findOneBySpy,
                createQueryBuilder: jest.fn().mockReturnValue({
                    update: jest.fn().mockReturnThis(),
                    set: jest.fn().mockReturnThis(),
                    where: jest.fn().mockReturnThis(),
                    execute: jest.fn().mockResolvedValue({}),
                }),
            } as any;
        });

        test('should update status directly for non-failure statuses', async () => {
            await service.updateStatus(1, InfraQueueStatus.COMPLETED);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, { status: InfraQueueStatus.COMPLETED });
        });

        test('should update status with error message for non-failure', async () => {
            await service.updateStatus(1, InfraQueueStatus.PROCESSING, 'Starting...');

            expect(entityUpdateSpy).toHaveBeenCalledWith(
                { id: 1 },
                { status: InfraQueueStatus.PROCESSING, error_message: 'Starting...' }
            );
        });

        test('should increment retry_count on FAILED status via query builder', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, retry_count: 1, module_type: InfraQueueModuleType.TRAINING });

            await service.updateStatus(1, InfraQueueStatus.FAILED, 'Some error');

            expect(service.entity.createQueryBuilder).toHaveBeenCalled();
        });

        test('should mark training as failed when retry count reaches max', async () => {
            const mockTraining = { id: 50, status: ModelTrainingStatus.PENDING, status_log: [], name: 'Train1' };
            findOneBySpy.mockResolvedValue({
                id: 1,
                retry_count: 3,
                module_type: InfraQueueModuleType.TRAINING,
                module_id: 50,
                company_id: 10,
                member_id: 5,
                error_message: 'Max retries',
            });

            const trainingFindSpy = jest.spyOn(ModelTrainingEntity, 'findOneBy').mockResolvedValue(mockTraining as any);
            const trainingUpdateSpy = jest.spyOn(ModelTrainingEntity, 'update').mockResolvedValue({} as any);

            await service.updateStatus(1, InfraQueueStatus.FAILED, 'Max retries');

            expect(trainingFindSpy).toHaveBeenCalledWith({ id: 50, is_delete: 0 });
            expect(trainingUpdateSpy).toHaveBeenCalledWith(
                { id: 50 },
                expect.objectContaining({ status: ModelTrainingStatus.FAILED })
            );

            trainingFindSpy.mockRestore();
            trainingUpdateSpy.mockRestore();
        });
    });

    describe('getQueueStats', () => {
        test('should return counts for each status', async () => {
            service.entity = {
                count: jest.fn()
                    .mockResolvedValueOnce(5)   // pending
                    .mockResolvedValueOnce(2)   // processing
                    .mockResolvedValueOnce(100) // completed
                    .mockResolvedValueOnce(3),  // failed
            } as any;

            const stats = await service.getQueueStats();

            expect(stats).toEqual({
                pending: 5,
                processing: 2,
                completed: 100,
                failed: 3,
            });
        });
    });

    describe('cancelQueueItem', () => {
        let entityFindOneSpy: jest.SpyInstance;
        let entityUpdateSpy: jest.SpyInstance;
        let trainingUpdateSpy: jest.SpyInstance;
        let trainingFindOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            entityFindOneSpy = jest.fn();
            entityUpdateSpy = jest.fn().mockResolvedValue({});
            service.entity = {
                findOne: entityFindOneSpy,
                update: entityUpdateSpy,
            } as any;

            trainingUpdateSpy = jest.spyOn(ModelTrainingEntity, 'update').mockResolvedValue({} as any);
            trainingFindOneBySpy = jest.spyOn(ModelTrainingEntity, 'findOneBy').mockResolvedValue(
                { id: 50, name: 'Train1', status: ModelTrainingStatus.PENDING, status_log: [] } as any
            );
        });

        afterEach(() => {
            trainingUpdateSpy.mockRestore();
            trainingFindOneBySpy.mockRestore();
        });

        test('should soft-delete a pending queue item', async () => {
            entityFindOneSpy.mockResolvedValue({
                id: 1,
                status: InfraQueueStatus.PENDING,
                module_type: InfraQueueModuleType.TRAINING,
                module_id: 50,
                company_id: 10,
                member_id: 5,
            });

            const result = await service.cancelQueueItem(1, 5);

            expect(entityUpdateSpy).toHaveBeenCalledWith({ id: 1 }, { is_delete: 1 });
            expect(result).toBe(true);
        });

        test('should throw if queue item is not found', async () => {
            entityFindOneSpy.mockResolvedValue(null);

            await expect(service.cancelQueueItem(999, 5)).rejects.toThrow('Queue item not found');
        });

        test('should throw if item is not in PENDING status', async () => {
            entityFindOneSpy.mockResolvedValue({
                id: 1,
                status: InfraQueueStatus.PROCESSING,
            });

            await expect(service.cancelQueueItem(1, 5)).rejects.toThrow('Only pending items can be cancelled');
        });
    });

    describe('processQueue', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                addOrderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };
            service.entity = {
                createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
                update: jest.fn().mockResolvedValue({}),
                findOneBy: jest.fn(),
            } as any;
        });

        test('should return 0 processed and 0 failed when queue is empty', async () => {
            const result = await service.processQueue();

            expect(result).toEqual({ processed: 0, failed: 0 });
        });

        test('should process items when resources are available', async () => {
            const pendingItem = {
                id: 1,
                module_type: InfraQueueModuleType.TRAINING,
                module_id: 50,
                accelerator_id: 1,
                accelerator_count: 1,
                company_id: 10,
                payload: { training_id: 50 },
            };
            mockQueryBuilder.getMany.mockResolvedValue([pendingItem]);

            // mock updateStatus calls
            const updateStatusSpy = jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined);
            const trainingFindSpy = jest.spyOn(ModelTrainingEntity, 'findOneBy').mockResolvedValue(
                { id: 50, name: 'Training Job' } as any
            );
            const trainingUpdateSpy = jest.spyOn(ModelTrainingEntity, 'update').mockResolvedValue({} as any);

            const result = await service.processQueue();

            expect(result.processed).toBe(1);
            expect(result.failed).toBe(0);
            expect(mockKafkaInstance.sendMessage).toHaveBeenCalledWith(
                KAFKAPRODUCERS.TRAININGINIT,
                pendingItem.payload
            );

            updateStatusSpy.mockRestore();
            trainingFindSpy.mockRestore();
            trainingUpdateSpy.mockRestore();
        });
    });
});
