import { BenchmarkingController } from '../src/controllers/benchmarking/benchmarkingController.controller';
import { ModelTrainingController } from '../src/controllers/modelTraining/modelTrainingController.controller';
import { APP_ROUTES } from '../src/core/AppRoutes';

describe('Benchmarking & Model Training Controllers Unit Tests', () => {
    describe('BenchmarkingController', () => {
        let controller: BenchmarkingController;

        beforeEach(() => {
            controller = new BenchmarkingController(APP_ROUTES.BENCHMARKING as any);
        });

        test('should initialize path and service correctly', () => {
            expect((controller as any).path).toBeDefined();
            expect(controller.service.getModuleName()).toBeDefined();
        });
    });

    describe('ModelTrainingController', () => {
        let controller: ModelTrainingController;
        let mockReq: any;
        let mockRes: any;

        beforeEach(() => {
            controller = new ModelTrainingController(APP_ROUTES.MODELTRAINING as any);
            mockReq = {
                body: { id: 10, status: 'COMPLETED' },
                originalUrl: '/api/v1/model_training/update-status',
                url: '/api/v1/model_training/update-status'
            };
            mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
                send: jest.fn().mockReturnThis(),
            };
            (controller as any).sendResponse = jest.fn();
            (controller as any).handleError = jest.fn();
        });

        test('updateStatus should call service updateStatus', async () => {
            const serviceSpy = jest.spyOn(controller.service, 'updateStatus').mockResolvedValue({ id: 10 } as any);

            await (controller as any).updateStatus(mockReq, mockRes, jest.fn());

            expect(serviceSpy).toHaveBeenCalled();
            expect((controller as any).sendResponse).toHaveBeenCalled();
        });
    });
});
