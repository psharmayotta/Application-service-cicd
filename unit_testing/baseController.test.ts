import { BaseController } from '../src/controllers/baseController.controller';
import { InferParams, Pagination } from '../src/core/InferParams';

// Create a concrete implementation for testing
class TestController extends BaseController {
    constructor() {
        const mockService: any = {
            getModel: jest.fn().mockReturnValue({}),
            getDTO: jest.fn().mockReturnValue(class {}),
            getModuleName: jest.fn().mockReturnValue('Test'),
            getMetaModel: jest.fn().mockReturnValue(null),
            getAll: jest.fn().mockResolvedValue([{ id: 1 }]),
            getById: jest.fn().mockResolvedValue({ id: 1 }),
            createRecord: jest.fn().mockResolvedValue({ id: 1 }),
            createMultiRecords: jest.fn().mockResolvedValue([{ id: 1 }]),
            deleteData: jest.fn().mockResolvedValue({ id: 1 }),
            updateDeleteFlagData: jest.fn().mockResolvedValue(true),
            getData: jest.fn().mockResolvedValue({ data: [] }),
            getDataById: jest.fn().mockResolvedValue({ id: 1 }),
        };
        super('/test' as any, undefined, mockService);
    }
}

jest.mock('../src/middlewares/authMiddleware', () => ({
    __esModule: true,
    default: (req: any, res: any, next: any) => next(),
}));

jest.mock('../src/middlewares/validationFormData.middleware', () => ({
    __esModule: true,
    default: () => (req: any, res: any, next: any) => next(),
}));

describe('BaseController Unit Tests', () => {
    let controller: TestController;
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        controller = new TestController();
        mockReq = {
            body: {},
            params: { id: '5' },
            query: {},
            url: '/test',
            originalUrl: '/api/v1/test',
            files: [],
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            req: { originalUrl: '/api/v1/test', url: '/test' },
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('validateData', () => {
        test('should return true if param.id is set', () => {
            const param = new InferParams();
            param.id = 5;
            expect(controller.validateData(param)).toBe(true);
        });

        test('should return false if param.id is null', () => {
            const param = new InferParams();
            param.id = null as any;
            expect(controller.validateData(param)).toBe(false);
        });
    });

    describe('handleSuccessMessage', () => {
        test('should return GET success message', () => {
            const msg = controller.handleSuccessMessage('GET', mockReq);
            expect(msg).toContain('Test');
        });

        test('should return POST (add) message when no body.id', () => {
            mockReq.body = {};
            const msg = controller.handleSuccessMessage('POST', mockReq);
            expect(msg).toContain('Test');
        });

        test('should return POST (update) message when body.id exists', () => {
            mockReq.body = { id: 5 };
            const msg = controller.handleSuccessMessage('POST', mockReq);
            expect(msg).toContain('Test');
        });

        test('should return DELETE success message', () => {
            const msg = controller.handleSuccessMessage('DELETE', mockReq);
            expect(msg).toContain('Test');
        });

        test('should return empty for unknown method', () => {
            const msg = controller.handleSuccessMessage('PATCH', mockReq);
            expect(msg).toBe('');
        });
    });

    describe('sendResponse', () => {
        test('should send response with correct status code', () => {
            controller.sendResponse('success', 'OK', { id: 1 } as any, null as any, mockRes, 200);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalled();
        });
    });

    describe('handleError', () => {
        test('should send error response for known error code', () => {
            controller.handleError('E10020', mockRes);
            expect(mockRes.status).toHaveBeenCalled();
            expect(mockRes.send).toHaveBeenCalled();
        });

        test('should use default error for unknown code', () => {
            controller.handleError('UNKNOWN', mockRes);
            expect(mockRes.status).toHaveBeenCalled();
        });
    });

    describe('setParamsForData', () => {
        test('should extract id from req.params', () => {
            mockReq.params.id = '42';
            const params = (controller as any).setParamsForData(mockReq);
            expect(params.id).toBe(42);
        });
    });

    describe('processData', () => {
        test('should return sanitized model from request body', () => {
            mockReq.body = { name: 'Test', value: 123 };
            const model = {} as any;
            const result = controller.processData(mockReq, model);
            // sanitizeBody returns the validated/sanitized model
            expect(result).toBeDefined();
        });
    });

    describe('getAll handler', () => {
        test('should call service.getAll and send response', async () => {
            await (controller as any).getAll(mockReq, mockRes, mockNext);
            expect(controller.service.getAll).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
        });
    });

    describe('getById handler', () => {
        test('should call service.getById', async () => {
            mockReq.params.id = '5';
            await (controller as any).getById(mockReq, mockRes, mockNext);
            expect(controller.service.getById).toHaveBeenCalledWith(
                expect.objectContaining({ id: 5 })
            );
        });

        test('should handle error when id is NaN', async () => {
            mockReq.params.id = 'abc';
            await (controller as any).getById(mockReq, mockRes, mockNext);
            // NaN will fail validateData
            expect(mockRes.status).toHaveBeenCalled();
        });
    });

    describe('postData handler', () => {
        test('should call service.createRecord', async () => {
            mockReq.body = { name: 'New' };
            await (controller as any).postData(mockReq, mockRes, mockNext);
            expect(controller.service.createRecord).toHaveBeenCalled();
        });
    });

    describe('deleteData handler', () => {
        test('should call service.deleteData', async () => {
            mockReq.params.id = '10';
            await (controller as any).deleteData(mockReq, mockRes, mockNext);
            expect(controller.service.deleteData).toHaveBeenCalled();
        });
    });

    describe('updateDeleteFlagData handler', () => {
        test('should call service.updateDeleteFlagData', async () => {
            mockReq.body = { id: 5 };
            await (controller as any).updateDeleteFlagData(mockReq, mockRes, mockNext);
            expect(controller.service.updateDeleteFlagData).toHaveBeenCalled();
        });
    });

    describe('getData handler', () => {
        test('should call service.getData', async () => {
            mockReq.body = { company_id: 10 };
            await (controller as any).getData(mockReq, mockRes, mockNext);
            expect(controller.service.getData).toHaveBeenCalled();
        });
    });

    describe('getDataById handler', () => {
        test('should call service.getDataById', async () => {
            mockReq.body = { id: 5 };
            await (controller as any).getDataById(mockReq, mockRes, mockNext);
            expect(controller.service.getDataById).toHaveBeenCalled();
        });
    });
});
