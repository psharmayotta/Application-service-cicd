import { PricingService } from '../src/utils/pricing/pricingService';
import Database from '../src/database/database';

jest.mock('../src/database/database', () => ({
    __esModule: true,
    default: {
        getInstance: jest.fn().mockReturnValue({
            executeExternalQuery: jest.fn().mockResolvedValue([]),
        }),
    },
}));

describe('PricingService Unit Tests', () => {
    let mockDb: any;

    beforeEach(() => {
        mockDb = Database.getInstance();
        jest.clearAllMocks();
    });

    describe('getPricePerSec', () => {
        test('should return 0 if companyId is falsy', async () => {
            const result = await PricingService.getPricePerSec(0, 1);
            expect(result).toBe(0);
        });

        test('should return 0 if acceleratorId is falsy', async () => {
            const result = await PricingService.getPricePerSec(10, 0);
            expect(result).toBe(0);
        });

        test('should return psec value from database query', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([{ psec: '0.0025' }]);

            const result = await PricingService.getPricePerSec(10, 3);

            expect(result).toBe(0.0025);
            expect(mockDb.executeExternalQuery).toHaveBeenCalled();
        });

        test('should return 0 if query returns empty result', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([]);

            const result = await PricingService.getPricePerSec(10, 3);
            expect(result).toBe(0);
        });

        test('should return 0 if query returns null psec', async () => {
            mockDb.executeExternalQuery.mockResolvedValue([{ psec: null }]);

            const result = await PricingService.getPricePerSec(10, 3);
            expect(result).toBe(0);
        });

        test('should return 0 and not throw on database error', async () => {
            mockDb.executeExternalQuery.mockRejectedValue(new Error('DB error'));

            const result = await PricingService.getPricePerSec(10, 3);
            expect(result).toBe(0);
        });
    });
});
