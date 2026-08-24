import { COST_FORECAST_API_TIMEOUT_MS } from '../src/config';
import { CompanyMemberRolesEntity } from '../src/entities/companyMemberRolesEntity';
import WalletService from '../src/services/wallet/walletService.services';

describe('WalletService cost forecast', () => {
    const companyId = 42;
    const memberId = 101;
    let walletEntity: { findOne: jest.Mock };
    let forecastClient: { get: jest.Mock };
    let service: WalletService;

    beforeEach(() => {
        walletEntity = {
            findOne: jest.fn().mockResolvedValue({ id: 119 }),
        };
        forecastClient = {
            get: jest.fn().mockResolvedValue({
                data: {
                    wallet_id: 119,
                    trend: { method: 'trend_regression', forecasts: [] },
                    simulation: { method: 'usage_simulation', forecasts: [] },
                },
            }),
        };
        service = new WalletService(
            walletEntity as any,
            {} as any,
            forecastClient as any,
            'https://forecast.example/cost-forecast/'
        );

        jest.spyOn(CompanyMemberRolesEntity, 'findOneBy').mockResolvedValue({ id: 7 } as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('resolves the organization wallet and forwards only supported forecast parameters', async () => {
        const result = await service.getCostForecast({
            company_id: companyId,
            member_id: memberId,
            months: 6,
            growth_factor: 0.08,
            wallet_id: 9999,
            base_spend: 1,
        } as any);

        expect(CompanyMemberRolesEntity.findOneBy).toHaveBeenCalledWith({
            company_id: companyId,
            member_id: memberId,
            active: true,
            is_access_active: true,
            is_delete: 0,
        });
        expect(walletEntity.findOne).toHaveBeenCalledWith({
            select: ['id'],
            where: { company_id: companyId, is_delete: 0 },
            order: { id: 'DESC' },
        });
        expect(forecastClient.get).toHaveBeenCalledWith(
            'https://forecast.example/cost-forecast/forecast',
            {
                params: {
                    wallet_id: 119,
                    months: 6,
                    growth_factor: 0.05,
                },
                timeout: COST_FORECAST_API_TIMEOUT_MS,
            }
        );
        expect(result.wallet_id).toBe(119);
    });

    test('rejects access when the member does not belong to the organization', async () => {
        jest.spyOn(CompanyMemberRolesEntity, 'findOneBy').mockRestore();
        jest.spyOn(CompanyMemberRolesEntity, 'findOneBy').mockResolvedValue(null);

        await expect(service.getCostForecast({
            company_id: companyId,
            member_id: memberId,
        })).rejects.toBe('E10003');

        expect(walletEntity.findOne).not.toHaveBeenCalled();
        expect(forecastClient.get).not.toHaveBeenCalled();
    });

    test('returns a not-found error when the organization has no wallet', async () => {
        walletEntity.findOne.mockResolvedValue(null);

        await expect(service.getCostForecast({
            company_id: companyId,
            member_id: memberId,
        })).rejects.toBe('E10074');

        expect(forecastClient.get).not.toHaveBeenCalled();
    });

    test('maps upstream failures to a service-unavailable error', async () => {
        forecastClient.get.mockRejectedValue({
            isAxiosError: true,
            code: 'ECONNREFUSED',
        });

        await expect(service.getCostForecast({
            company_id: companyId,
            member_id: memberId,
        })).rejects.toBe('E10076');
    });

    test.each([
        { months: 0 },
        { months: 13 },
        { months: 1.5 },
    ])('rejects invalid forecast controls: %p', async (forecastControls) => {
        await expect(service.getCostForecast({
            company_id: companyId,
            member_id: memberId,
            ...forecastControls,
        })).rejects.toBe('E10004');

        expect(CompanyMemberRolesEntity.findOneBy).not.toHaveBeenCalled();
    });
});
