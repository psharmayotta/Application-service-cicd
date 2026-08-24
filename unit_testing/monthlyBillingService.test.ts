import { MonthlyBillingService } from '../src/services/monthlyBilling/monthlyBillingService.services';
import Database from '../src/database/database';
import { BudgetControlEntity } from '../src/entities/budgetControlEntity';

jest.mock('../src/database/database', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            executeExternalQuery: jest.fn().mockResolvedValue([]),
        }),
    },
}));

// Mock BudgetControlEntity.find to avoid DataSource error
jest.spyOn(BudgetControlEntity, 'find').mockResolvedValue([] as any);

describe('MonthlyBillingService Unit Tests', () => {
    let service: MonthlyBillingService;
    let mockDb: any;

    beforeEach(() => {
        service = new MonthlyBillingService();
        mockDb = Database.getInstance();
        jest.clearAllMocks();
        // Re-apply the mock since clearAllMocks resets it
        jest.spyOn(BudgetControlEntity, 'find').mockResolvedValue([] as any);
    });

    describe('Service Metadata', () => {
        test('should return "Monthly Billing" as module name', () => {
            expect(service.getModuleName()).toBe('Monthly Billing');
        });

        test('should return model and DTO', () => {
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('prepareQuery', () => {
        test('should return empty array if company_id is missing', async () => {
            const result = await service.prepareQuery({});
            expect(result).toEqual([]);
        });

        test('should call db.executeExternalQuery with company_id', async () => {
            mockDb.executeExternalQuery
                .mockResolvedValueOnce([
                    { date: '2025-01-15', reference_type: 'DEPLOYMENT', amount: '10.50' },
                ])
                .mockResolvedValueOnce([{ last_month_bill_amount: '5.25' }]);

            const result = await service.prepareQuery({ company_id: 10 });

            expect(mockDb.executeExternalQuery).toHaveBeenCalled();
            const sqlArg = mockDb.executeExternalQuery.mock.calls[0][0];
            expect(sqlArg).toContain('company_id');
            expect(result.last_month_bill_amount).toBe(5.25);
        });

        test('should use provided month and year for date filtering', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([]);

            await service.prepareQuery({ company_id: 10, month: '3', year: '2025' });

            expect(mockDb.executeExternalQuery.mock.calls[0][1]).toEqual([10, 3, 2025]);
        });

        test('should handle db results and return formatted data', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([
                { date: '2025-01-15', reference_type: 'DEPLOYMENT', amount: '10.00', deployment_name: 'D1' },
            ]);

            const result = await service.prepareQuery({ company_id: 10 });
            expect(result).toBeDefined();
            expect(result.last_month_bill_amount).toBe(0);
        });

        test('should fetch December of the previous year when January is requested', async () => {
            mockDb.executeExternalQuery
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ last_month_bill_amount: '42.678' }]);

            const result = await service.prepareQuery({ company_id: 10, month: '1', year: '2025' });

            expect(mockDb.executeExternalQuery.mock.calls[1][1]).toEqual([10, 12, 2024]);
            expect(result.last_month_bill_amount).toBe(42.68);
        });
    });
});
