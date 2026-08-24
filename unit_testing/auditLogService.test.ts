import AuditLogService from '../src/services/auditLog/auditLogService.services';
import { AuditLogEntity } from '../src/entities/auditLogEntity';
import { AuditLogModuleEntity } from '../src/entities/auditLogModuleEntity';
import { AuditLogActionEntity } from '../src/entities/auditLogActionEntity';
import { MembersEntity } from '../src/entities/membersEntity';
import { CompanyMemberRolesEntity } from '../src/entities/companyMemberRolesEntity';

describe('AuditLogService Unit Tests', () => {
    let service: AuditLogService;

    beforeEach(() => {
        service = new AuditLogService();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Service Basics', () => {
        test('should return correct metadata from getters', () => {
            expect(service.getModuleName()).toBe('Audit Log');
            expect(service.getModel()).toBeDefined();
            expect(service.getDTO()).toBeDefined();
        });
    });

    describe('extractFailureReason', () => {
        test('should extract string failure reasons', () => {
            const reason = AuditLogService.extractFailureReason('Connection timeout');
            expect(reason).toBe('Connection timeout');
        });

        test('should extract Error object message', () => {
            const err = new Error('Database crashed');
            const reason = AuditLogService.extractFailureReason(err);
            expect(reason).toBe('Database crashed');
        });

        test('should extract nested object error messages', () => {
            const nested = { details: { message: 'Unauthorized access' } };
            const reason = AuditLogService.extractFailureReason(nested);
            expect(reason).toBe('Unauthorized access');
        });

        test('should return null for null/undefined/empty input', () => {
            expect(AuditLogService.extractFailureReason(null, undefined)).toBeNull();
        });

        test('should truncate reason longer than 1000 characters', () => {
            const longStr = 'a'.repeat(1200);
            const reason = AuditLogService.extractFailureReason(longStr);
            expect(reason?.length).toBe(1000);
            expect(reason?.endsWith('...')).toBe(true);
        });
    });

    describe('getModuleId & getActionId (Static helper caching)', () => {
        test('should fetch or create module entity and cache it', async () => {
            jest.spyOn(AuditLogModuleEntity, 'findOne').mockResolvedValue(null as any);
            jest.spyOn(AuditLogModuleEntity, 'save').mockResolvedValue({ id: 42, name: 'MODEL' } as any);

            jest.spyOn(AuditLogActionEntity, 'findOne').mockResolvedValue(null as any);
            jest.spyOn(AuditLogActionEntity, 'save').mockResolvedValue({ id: 99, name: 'CREATE' } as any);

            jest.spyOn(AuditLogEntity, 'save').mockResolvedValue({ id: 1 } as any);

            await AuditLogService.log({
                company_id: 1,
                member_id: 2,
                module: 'MODEL',
                action: 'CREATE',
                description: 'Created model'
            });

            expect(AuditLogModuleEntity.save).toHaveBeenCalledWith({ name: 'MODEL' });
            expect(AuditLogActionEntity.save).toHaveBeenCalledWith({ name: 'CREATE' });
        });
    });

    describe('logFailureIncident', () => {
        test('should construct failure description and call log', async () => {
            const logSpy = jest.spyOn(AuditLogService, 'log').mockResolvedValue();

            await AuditLogService.logFailureIncident({
                company_id: 10,
                member_id: 5,
                module: 'DATASET',
                entity_name: 'CustomerData',
                reason: new Error('S3 bucket unreachable')
            });

            expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
                company_id: 10,
                member_id: 5,
                module: 'DATASET',
                action: 'FAILED',
                description: 'CustomerData failed. Reason: S3 bucket unreachable',
            }));
        });
    });

    describe('prepareQuery', () => {
        test('should return empty set if companyId is missing', async () => {
            const res = await service.prepareQuery({});
            expect(res.records).toEqual([]);
            expect(res.totalRecords).toBe(0);
        });

        test('should query records and enrich member info', async () => {
            const mockLogRecord = {
                id: 101,
                company_id: 1,
                member_id: 10,
                module: { name: 'MODEL' },
                action: { name: 'CREATE' },
                created_at: new Date(),
                description: 'Created test model',
                entity_name: 'MyModel'
            };

            const mockMember = {
                id: 10,
                full_name: 'John Doe',
                profile_picture: 'https://example.com/pic.jpg',
            };

            jest.spyOn(AuditLogEntity, 'findAndCount').mockResolvedValue([[mockLogRecord as any], 1]);
            jest.spyOn(MembersEntity, 'find').mockResolvedValue([mockMember as any]);

            const res = await service.prepareQuery({
                company_id: 1,
                module: 'MODEL',
                action: 'CREATE',
                page_number: 1,
                page_size: 10
            });

            expect(res.data.length).toBe(1);
            expect(res.data[0].action).toBe('Created');
            expect(res.data[0].member_name).toBe('John Doe');
            expect(res.pagination.total).toBe(1);
        });

        test.each([
            ['Last 12 hours', 12 * 60 * 60 * 1000],
            ['Last 24 hours', 24 * 60 * 60 * 1000],
            ['Last 1 week', 7 * 24 * 60 * 60 * 1000],
            ['Last 1 Month', 30 * 24 * 60 * 60 * 1000],
        ])('should filter created_at for the %s preset', async (dateRange, duration) => {
            const now = new Date('2026-08-17T12:00:00.000Z');
            jest.useFakeTimers();
            jest.setSystemTime(now);
            const findSpy = jest.spyOn(AuditLogEntity, 'findAndCount').mockResolvedValue([[], 0]);

            await service.prepareQuery({
                company_id: 1,
                date_range: dateRange,
            });

            const where = findSpy.mock.calls[0][0].where as any;
            expect(where.created_at._type).toBe('between');
            expect(where.created_at._value).toEqual([
                new Date(now.getTime() - duration),
                now,
            ]);
        });

        test('should apply an inclusive custom date range', async () => {
            const findSpy = jest.spyOn(AuditLogEntity, 'findAndCount').mockResolvedValue([[], 0]);
            const startDate = '2026-08-11T02:00:00.000Z';
            const endDate = '2026-08-15T14:00:00.000Z';

            await service.prepareQuery({
                company_id: 1,
                filterOptions: {
                    company_id: 1,
                    date_range: 'Custom',
                    start_date: startDate,
                    end_date: endDate,
                },
            });

            const where = findSpy.mock.calls[0][0].where as any;
            expect(where.created_at._type).toBe('between');
            expect(where.created_at._value).toEqual([new Date(startDate), new Date(endDate)]);
        });

        test('should require both dates for a custom range', async () => {
            await expect(service.prepareQuery({
                company_id: 1,
                date_range: 'Custom',
                start_date: '2026-08-11T02:00:00.000Z',
            })).rejects.toBe('E10021');
        });

        test('should reject invalid or reversed custom dates', async () => {
            await expect(service.prepareQuery({
                company_id: 1,
                date_range: 'Custom',
                start_date: '2026-08-15T14:00:00.000Z',
                end_date: '2026-08-11T02:00:00.000Z',
            })).rejects.toBe('E10004');
        });

        test('should reject an unsupported date range', async () => {
            await expect(service.prepareQuery({
                company_id: 1,
                date_range: 'Last 2 years',
            })).rejects.toBe('E10004');
        });
    });
});
