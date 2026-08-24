import CompanyService from '../src/services/company/companyService.services';
import { CompanyModel } from '../src/database/repository/company/company.model';
import AuditLogService from '../src/services/auditLog/auditLogService.services';

jest.mock('../src/services/auditLog/auditLogService.services', () => ({
    __esModule: true,
    default: { log: jest.fn().mockResolvedValue(undefined) },
}));

describe('CompanyService audit logging', () => {
    const service = new CompanyService();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses the Organization audit module', () => {
        expect(service.getModuleName()).toBe('Organization');
    });

    test('logs an update when company/save receives an existing id', async () => {
        const result = {
            id: 42,
            company_name: 'Updated Organization',
            created_by: 7,
        } as CompanyModel;
        const model = {
            id: 42,
            decryptToken: { member_id: 9 },
            previous_company_name: 'My Organisation',
        } as CompanyModel;

        await service.createPostProcess(result, model, null);

        expect(AuditLogService.log).toHaveBeenCalledWith({
            company_id: 42,
            member_id: 9,
            module: 'Organization',
            action: 'UPDATE',
            entity_type: 'CompanyEntity',
            entity_id: 42,
            entity_name: 'My Organisation',
            description: 'My Organisation has been updated to Updated Organization',
            ip_address: '',
        });
    });
});
