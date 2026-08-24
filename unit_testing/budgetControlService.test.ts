import BudgetControlService from '../src/services/budgetControl/budgetControlService.services';
import { BudgetControlEntity } from '../src/entities/budgetControlEntity';
import { BudgetAlertHistoryEntity } from '../src/entities/budgetAlertHistoryEntity';
import { BudgetPeriodType } from '../src/config';
import Database from '../src/database/database';
import { WebSocketService } from '../src/utils/webSocket/webSocketService';

jest.mock('../src/database/database', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            executeExternalQuery: jest.fn().mockResolvedValue([]),
        }),
    },
}));

jest.mock('../src/utils/webSocket/webSocketService', () => ({
    WebSocketService: { pushMessageToCompany: jest.fn().mockResolvedValue(true) },
}));

jest.mock('../src/services/webhook/webhookService.services', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        dispatchAlert: jest.fn().mockResolvedValue(true),
    })),
}));

jest.mock('../src/services/budgetAlertHistory/budgetAlertHistoryService.services', () => ({
    BudgetAlertHistoryService: jest.fn().mockImplementation(() => ({
        createRecord: jest.fn().mockResolvedValue({ id: 1 }),
    })),
}));

jest.mock('axios', () => ({ post: jest.fn().mockResolvedValue({ status: 200, data: {} }) }));

describe('BudgetControlService Unit Tests', () => {
    let service: BudgetControlService;
    let mockDb: any;

    beforeEach(() => {
        service = new BudgetControlService();
        mockDb = Database.getInstance();
        jest.clearAllMocks();
    });

    describe('Service Metadata', () => {
        test('should return "Budget Control" as module name', () => {
            expect(service.getModuleName()).toBe('Budget Control');
        });

        test('should return model and DTO', () => {
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('transformModel', () => {
        test('should assign user_id from decryptToken member_id', () => {
            const model = { decryptToken: { member_id: 888 } } as any;
            const processed = service.transformModel(model);
            expect(processed.user_id).toBe(888);
        });

        test('should not change user_id if decryptToken is missing', () => {
            const model = { user_id: 123 } as any;
            const processed = service.transformModel(model);
            expect(processed.user_id).toBe(123);
        });

        test('should not change user_id if decryptToken has no member_id', () => {
            const model = { user_id: 456, decryptToken: {} } as any;
            const processed = service.transformModel(model);
            expect(processed.user_id).toBe(456);
        });
    });

    describe('prepareQuery', () => {
        test('should return empty array if company_id is NaN', async () => {
            const result = await service.prepareQuery({ company_id: 'abc' });
            expect(result).toEqual([]);
        });

        test('should return empty array if company_id is missing', async () => {
            const result = await service.prepareQuery({});
            expect(result).toEqual([]);
        });

        test('should execute SQL query with company_id', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, budget: '1000', current_spent: '500', type: 'Monthly', auto_stop_resources: 1 },
            ]);

            const result = await service.prepareQuery({ company_id: 10 });

            expect(mockDb.executeExternalQuery).toHaveBeenCalled();
            const sql = mockDb.executeExternalQuery.mock.calls[0][0];
            expect(sql).toContain('10');
            expect(result).toHaveLength(1);
        });

        test('should include search filter in SQL', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([]);

            await service.prepareQuery({ company_id: 10, search_text: 'prod' });

            const sql = mockDb.executeExternalQuery.mock.calls[0][0];
            expect(sql).toContain('prod');
        });
    });

    describe('createPostProcess', () => {
        let alertUpdateSpy: jest.SpyInstance;

        beforeEach(() => {
            alertUpdateSpy = jest.spyOn(BudgetAlertHistoryEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            alertUpdateSpy.mockRestore();
        });

        test('should soft-delete alert history on UPDATE (model.id present)', async () => {
            const result = { id: 1 } as any;
            const model = { id: 1 } as any;

            await service.createPostProcess(result, model, null);

            expect(alertUpdateSpy).toHaveBeenCalledWith(
                { budget_control_id: 1, is_delete: 0 },
                { is_delete: 1 }
            );
        });

        test('should not touch alert history on CREATE (no model.id)', async () => {
            const result = { id: 1 } as any;
            const model = {} as any;

            await service.createPostProcess(result, model, null);

            expect(alertUpdateSpy).not.toHaveBeenCalled();
        });
    });

    describe('checkIsSuspended', () => {
        test('should return true if monthly budget breached and auto_stop_resources enabled', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '1200', auto_stop_resources: 1 },
            ]);

            const result = await BudgetControlService.checkIsSuspended(10);
            expect(result).toBe(true);
        });

        test('should return false if budget not breached', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '800', auto_stop_resources: 1 },
            ]);

            const result = await BudgetControlService.checkIsSuspended(10);
            expect(result).toBe(false);
        });

        test('should return false if auto_stop_resources disabled even when breached', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '1200', auto_stop_resources: 0 },
            ]);

            const result = await BudgetControlService.checkIsSuspended(10);
            expect(result).toBe(false);
        });

        test('should return false for daily budget even if breached', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, type: BudgetPeriodType.DAILY, budget: '100', current_spent: '150', auto_stop_resources: 1 },
            ]);

            const result = await BudgetControlService.checkIsSuspended(10);
            expect(result).toBe(false);
        });

        test('should return false if no budget rows exist', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([]);

            const result = await BudgetControlService.checkIsSuspended(10);
            expect(result).toBe(false);
        });
    });

    describe('markAlertAsSeen', () => {
        let findOneBySpy: jest.SpyInstance;
        let updateSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.spyOn(BudgetAlertHistoryEntity, 'findOneBy');
            updateSpy = jest.spyOn(BudgetAlertHistoryEntity, 'update').mockResolvedValue({} as any);
        });

        afterEach(() => {
            findOneBySpy.mockRestore();
            updateSpy.mockRestore();
        });

        test('should mark all unseen alerts for the budget_control_id as seen', async () => {
            findOneBySpy.mockResolvedValue({ id: 1, budget_control_id: 5 });

            await BudgetControlService.markAlertAsSeen(1);

            expect(updateSpy).toHaveBeenCalledWith(
                { budget_control_id: 5, is_seen: false, is_delete: 0 },
                { is_seen: true }
            );
        });

        test('should do nothing if alert not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            await BudgetControlService.markAlertAsSeen(999);

            expect(updateSpy).not.toHaveBeenCalled();
        });
    });

    describe('getActiveBudgetAlerts', () => {
        let findSpy: jest.SpyInstance;

        beforeEach(() => {
            findSpy = jest.spyOn(BudgetAlertHistoryEntity, 'find');
        });

        afterEach(() => {
            findSpy.mockRestore();
        });

        test('should return empty array if no unseen alerts', async () => {
            findSpy.mockResolvedValue([]);

            const result = await BudgetControlService.getActiveBudgetAlerts(10);
            expect(result).toEqual([]);
        });

        test('should return formatted alerts with budget info', async () => {
            findSpy.mockResolvedValue([
                { id: 1, budget_control_id: 5, threshold_level: 100, company_id: 10, is_seen: false },
            ]);
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 5, name: 'Monthly Budget', type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '1100' },
            ]);

            const result = await BudgetControlService.getActiveBudgetAlerts(10);

            expect(result).toHaveLength(1);
            expect(result[0].budget_alert_id).toBe(1);
            expect(result[0].threshold_level).toBe(100);
            expect(result[0].message).toContain('100%');
        });

        test('should deduplicate alerts by budget_control_id (only latest per budget)', async () => {
            findSpy.mockResolvedValue([
                { id: 3, budget_control_id: 5, threshold_level: 100, company_id: 10 },
                { id: 2, budget_control_id: 5, threshold_level: 2, company_id: 10 },
                { id: 1, budget_control_id: 6, threshold_level: 1, company_id: 10 },
            ]);
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 5, name: 'Monthly', type: 'Monthly', budget: '1000', current_spent: '1100' },
                { id: 6, name: 'Daily', type: 'Daily', budget: '100', current_spent: '80' },
            ]);

            const result = await BudgetControlService.getActiveBudgetAlerts(10);

            // Should have only 2 (one per budget_control_id, deduped)
            expect(result).toHaveLength(2);
        });
    });

    describe('checkAndTriggerAlert', () => {
        let findOneSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneSpy = jest.spyOn(BudgetAlertHistoryEntity, 'findOne');
        });

        afterEach(() => {
            findOneSpy.mockRestore();
        });

        test('should create alert when 100% budget breached and no existing alert', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, name: 'ProdBudget', type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '1100', auto_stop_resources: 0, threshold_alert_1: null, threshold_alert_2: null, threshold_alert_3: null },
            ]);
            findOneSpy.mockResolvedValue(null); // no existing alert

            await BudgetControlService.checkAndTriggerAlert(10);

            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalledWith(
                '10',
                expect.objectContaining({ event: 'BUDGET_BREACH' })
            );
        });

        test('should not create alert if one already exists for the period', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, name: 'ProdBudget', type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '1100', auto_stop_resources: 0, threshold_alert_1: null, threshold_alert_2: null, threshold_alert_3: null },
            ]);
            findOneSpy.mockResolvedValue({ id: 99 }); // existing alert

            await BudgetControlService.checkAndTriggerAlert(10);

            expect(WebSocketService.pushMessageToCompany).not.toHaveBeenCalled();
        });

        test('should trigger threshold alerts when spent crosses threshold', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { id: 1, name: 'Budget', type: BudgetPeriodType.MONTHLY, budget: '1000', current_spent: '750', auto_stop_resources: 0, threshold_alert_1: '700', threshold_alert_2: '500', threshold_alert_3: '300' },
            ]);
            findOneSpy.mockResolvedValue(null); // no existing alert

            await BudgetControlService.checkAndTriggerAlert(10);

            expect(WebSocketService.pushMessageToCompany).toHaveBeenCalled();
        });

        test('should handle empty budget rows gracefully', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([]);

            await expect(BudgetControlService.checkAndTriggerAlert(10)).resolves.toBeUndefined();
        });
    });
});
