import { checkReservationForGpu, getHardwareMasterIdFromSpecs, enrichWithReservationStatus } from '../src/utils/reservationCheck';
import { ReservationEntity } from '../src/entities/reservationEntity';
import { HardwareSpecsEntity } from '../src/entities/hardwareSpecsEntity';
import { HardwareMasterEntity } from '../src/entities/hardwareMasterEntity';

describe('ReservationCheck Utility Tests', () => {
    describe('checkReservationForGpu', () => {
        let findOneSpy: jest.SpyInstance;

        beforeEach(() => {
            findOneSpy = jest.spyOn(ReservationEntity, 'findOne');
        });

        afterEach(() => {
            findOneSpy.mockRestore();
        });

        test('should return not reserved if companyId is falsy', async () => {
            const result = await checkReservationForGpu(0, 1, 1);
            expect(result).toEqual({ is_reserved: false, reservation_id: null });
        });

        test('should return not reserved if hardwareMasterId is falsy', async () => {
            const result = await checkReservationForGpu(10, 0, 1);
            expect(result).toEqual({ is_reserved: false, reservation_id: null });
        });

        test('should return reserved if active approved reservation exists with enough count', async () => {
            findOneSpy.mockResolvedValue({ id: 5, accelerator_count: 4 });

            const result = await checkReservationForGpu(10, 1, 2);

            expect(result).toEqual({ is_reserved: true, reservation_id: 5 });
        });

        test('should return not reserved if reservation accelerator_count is less than requested', async () => {
            findOneSpy.mockResolvedValue({ id: 5, accelerator_count: 1 });

            const result = await checkReservationForGpu(10, 1, 4);

            expect(result).toEqual({ is_reserved: false, reservation_id: null });
        });

        test('should return not reserved if no reservation found', async () => {
            findOneSpy.mockResolvedValue(null);

            const result = await checkReservationForGpu(10, 1, 2);

            expect(result).toEqual({ is_reserved: false, reservation_id: null });
        });

        test('should handle errors gracefully and return not reserved', async () => {
            findOneSpy.mockRejectedValue(new Error('DB error'));

            const result = await checkReservationForGpu(10, 1, 2);

            expect(result).toEqual({ is_reserved: false, reservation_id: null });
        });
    });

    describe('getHardwareMasterIdFromSpecs', () => {
        let findOneBySpy: jest.SpyInstance;

        beforeEach(() => {
            findOneBySpy = jest.spyOn(HardwareSpecsEntity, 'findOneBy');
        });

        afterEach(() => {
            findOneBySpy.mockRestore();
        });

        test('should return null if hardwareSpecsId is falsy', async () => {
            const result = await getHardwareMasterIdFromSpecs(0);
            expect(result).toBeNull();
        });

        test('should return hardware_master_id from specs', async () => {
            findOneBySpy.mockResolvedValue({ id: 10, hardware_master_id: 3 });

            const result = await getHardwareMasterIdFromSpecs(10);

            expect(result).toBe(3);
        });

        test('should return null if specs not found', async () => {
            findOneBySpy.mockResolvedValue(null);

            const result = await getHardwareMasterIdFromSpecs(999);

            expect(result).toBeNull();
        });

        test('should handle errors gracefully', async () => {
            findOneBySpy.mockRejectedValue(new Error('DB error'));

            const result = await getHardwareMasterIdFromSpecs(10);

            expect(result).toBeNull();
        });
    });

    describe('enrichWithReservationStatus', () => {
        let reservationSpy: jest.SpyInstance;
        let hwMasterSpy: jest.SpyInstance;

        beforeEach(() => {
            reservationSpy = jest.spyOn(ReservationEntity, 'findOne');
            hwMasterSpy = jest.spyOn(HardwareMasterEntity, 'findOneBy');
        });

        afterEach(() => {
            reservationSpy.mockRestore();
            hwMasterSpy.mockRestore();
        });

        test('should return message unchanged if null', async () => {
            const result = await enrichWithReservationStatus(null);
            expect(result).toBeNull();
        });

        test('should return message unchanged if not an object', async () => {
            const result = await enrichWithReservationStatus('string');
            expect(result).toBe('string');
        });

        test('should skip if already enriched (is_reserved defined)', async () => {
            const msg = { is_reserved: true, reservation_id: 5 };
            const result = await enrichWithReservationStatus(msg);
            expect(result).toBe(msg);
            expect(reservationSpy).not.toHaveBeenCalled();
        });

        test('should mark as not reserved if no company_id', async () => {
            const msg = { name: 'test' };
            const result = await enrichWithReservationStatus(msg);
            expect(result).toEqual({ name: 'test' });
        });

        test('should mark not reserved if no hardware can be resolved', async () => {
            const msg = { company_id: 10, name: 'test' };
            const result = await enrichWithReservationStatus(msg);
            expect(result.is_reserved).toBe(false);
            expect(result.reservation_id).toBeNull();
        });

        test('should use accelerator_id directly when present', async () => {
            reservationSpy.mockResolvedValue({ id: 7, accelerator_count: 8 });

            const msg = { company_id: 10, accelerator_id: 3, accelerator_count: 2 };
            const result = await enrichWithReservationStatus(msg);

            expect(result.is_reserved).toBe(true);
            expect(result.reservation_id).toBe(7);
        });

        test('should resolve hardware_master by accelerator name', async () => {
            hwMasterSpy.mockResolvedValue({ id: 3, model_name: 'A100' });
            reservationSpy.mockResolvedValue({ id: 8, accelerator_count: 4 });

            const msg = { company_id: 10, accelerator: 'A100', accelerator_count: 2 };
            const result = await enrichWithReservationStatus(msg);

            expect(result.is_reserved).toBe(true);
            expect(result.reservation_id).toBe(8);
        });

        test('should resolve hardware_master by gpu_type field', async () => {
            hwMasterSpy.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 4, model_name: 'H100' });
            reservationSpy.mockResolvedValue(null);

            const msg = { company_id: 10, gpu_type: 'H100' };
            const result = await enrichWithReservationStatus(msg);

            expect(result.is_reserved).toBe(false);
        });

        test('should handle errors gracefully', async () => {
            reservationSpy.mockRejectedValue(new Error('DB error'));

            const msg = { company_id: 10, accelerator_id: 3 };
            const result = await enrichWithReservationStatus(msg);

            expect(result.is_reserved).toBe(false);
            expect(result.reservation_id).toBeNull();
        });
    });
});
