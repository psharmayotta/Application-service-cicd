import { AuditLogController } from '../src/controllers/auditLog/auditLogController.controller';
import { APP_ROUTES } from '../src/core/AppRoutes';

describe('AuditLogController Unit Tests', () => {
    let controller: AuditLogController;
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        controller = new AuditLogController(APP_ROUTES.AUDIT_LOG as any);
        mockReq = {
            body: { company_id: 1 },
            originalUrl: '/api/v1/audit_log/members',
            url: '/api/v1/audit_log/members'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        (controller as any).sendResponse = jest.fn();
        jest.clearAllMocks();
    });

    test('getAuditLogMembers should send success response', async () => {
        const mockMembers = [{ id: 10, full_name: 'John Doe' }];
        const serviceSpy = jest.spyOn(controller.service, 'getAuditLogMembers').mockResolvedValue(mockMembers as any);

        await (controller as any).getAuditLogMembers(mockReq, mockRes, jest.fn());

        expect(serviceSpy).toHaveBeenCalledWith({ company_id: 1 });
        expect((controller as any).sendResponse).toHaveBeenCalled();
    });

    test('getAuditLogModules should return distinct module list', async () => {
        const serviceSpy = jest.spyOn(controller.service, 'getAuditLogModules').mockResolvedValue(['MODEL', 'DATASET'] as any);

        await (controller as any).getAuditLogModules(mockReq, mockRes, jest.fn());

        expect(serviceSpy).toHaveBeenCalledWith({ company_id: 1 });
        expect((controller as any).sendResponse).toHaveBeenCalled();
    });

    test('getAuditLogActions should return distinct action list', async () => {
        const serviceSpy = jest.spyOn(controller.service, 'getAuditLogActions').mockResolvedValue(['CREATE', 'DELETE'] as any);

        await (controller as any).getAuditLogActions(mockReq, mockRes, jest.fn());

        expect(serviceSpy).toHaveBeenCalledWith({ company_id: 1 });
        expect((controller as any).sendResponse).toHaveBeenCalled();
    });
});
