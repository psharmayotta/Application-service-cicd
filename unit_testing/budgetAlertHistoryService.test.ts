import BudgetAlertHistoryService from '../src/services/budgetAlertHistory/budgetAlertHistoryService.services';

describe('BudgetAlertHistoryService Unit Tests', () => {
    let service: BudgetAlertHistoryService;

    beforeEach(() => {
        service = new BudgetAlertHistoryService();
    });

    test('should return correct service metadata', () => {
        expect(service.getModuleName()).toBe('Budget Alert History');
        expect(service.getModel()).toBeDefined();
        expect(service.getDTO()).toBeDefined();
    });
});
