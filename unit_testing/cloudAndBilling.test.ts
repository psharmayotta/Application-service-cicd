import { CloudAccountController } from '../src/controllers/cloudAccount/cloudAccountController.controller';
import { MonthlyBillingController } from '../src/controllers/monthlyBilling/monthlyBillingController.controller';
import { APP_ROUTES } from '../src/core/AppRoutes';

describe('Cloud & Billing Controllers Unit Tests', () => {
    describe('CloudAccountController', () => {
        let controller: CloudAccountController;

        beforeEach(() => {
            controller = new CloudAccountController(APP_ROUTES.CLOUDACCOUNT as any);
        });

        test('prepareQueryParams should extract parameters from req.body', () => {
            const mockReq: any = {
                body: {
                    pageNumber: 1,
                    pageSize: 20,
                    company_id: 5,
                    search: 'aws ',
                    module_name: 'cloud'
                }
            };
            const paramContainer: any = { filter: {} };

            const processed = controller.prepareQueryParams(paramContainer, mockReq);

            expect(processed.pageNumber).toBe(1);
            expect(processed.pageSize).toBe(20);
            expect(processed.company_id).toBe(5);
            expect(processed.filter.search).toBe('aws');
        });
    });

    describe('MonthlyBillingController', () => {
        let controller: MonthlyBillingController;

        beforeEach(() => {
            controller = new MonthlyBillingController(APP_ROUTES.MONTHLY_BILLING as any);
        });

        test('controller initialization should set route path', () => {
            expect((controller as any).path).toBeDefined();
        });
    });
});
