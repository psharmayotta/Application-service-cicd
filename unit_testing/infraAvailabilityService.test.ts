import InfraAvailabilityService from '../src/services/infraAvailability/infraAvailabilityService.services';
import { HardwareMasterEntity } from '../src/entities/hardwareMasterEntity';
import { HardwareSpecsEntity } from '../src/entities/hardwareSpecsEntity';
import { InfraNodesEntity } from '../src/entities/infraNodesEntity';
import { InfraHardwareModuleMapperEntity } from '../src/entities/infraHardwareModuleMapperEntity';
import { HardwareUtilizationEntity } from '../src/entities/hardwareUtilization';

describe('InfraAvailabilityService Unit Tests', () => {
    let service: InfraAvailabilityService;

    beforeEach(() => {
        service = new InfraAvailabilityService();
        jest.clearAllMocks();
    });

    describe('checkAvailabilityByUtilization', () => {
        let hwMasterSpy: jest.SpyInstance;
        let hwSpecsSpy: jest.SpyInstance;
        let nodesSpy: jest.SpyInstance;
        let utilizationSpy: jest.SpyInstance;

        beforeEach(() => {
            hwMasterSpy = jest.spyOn(HardwareMasterEntity, 'findOne');
            hwSpecsSpy = jest.spyOn(HardwareSpecsEntity, 'find');
            nodesSpy = jest.spyOn(InfraNodesEntity, 'createQueryBuilder');
            utilizationSpy = jest.spyOn(HardwareUtilizationEntity, 'findOne');
        });

        afterEach(() => {
            hwMasterSpy.mockRestore();
            hwSpecsSpy.mockRestore();
            nodesSpy.mockRestore();
            utilizationSpy.mockRestore();
        });

        test('should return not available if hardware master not found', async () => {
            hwMasterSpy.mockResolvedValue(null);

            const result = await service.checkAvailabilityByUtilization(999, 2);

            expect(result).toEqual({ available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 });
        });

        test('should return not available if no hardware specs found', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, core_count: 8, model_name: 'A100' });
            hwSpecsSpy.mockResolvedValue([]);

            const result = await service.checkAvailabilityByUtilization(1, 2);

            expect(result).toEqual({ available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 });
        });

        test('should return not available if no available nodes', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, core_count: 8, model_name: 'A100' });
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            });

            const result = await service.checkAvailabilityByUtilization(1, 2);

            expect(result).toEqual({ available: false, freeCount: 0, totalCount: 0, allocatedCount: 0 });
        });

        test('should return available=true when node has enough free GPUs', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, core_count: 8, model_name: 'A100' });
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([{ id: 100, hostname: 'gpu-node-1' }]),
            });
            utilizationSpy.mockResolvedValue({ free_gpu_count: 4 });

            const result = await service.checkAvailabilityByUtilization(1, 2);

            expect(result.available).toBe(true);
            expect(result.freeCount).toBe(4);
            expect(result.totalCount).toBe(8);
            expect(result.allocatedCount).toBe(4);
        });

        test('should return available=false when no node has enough free GPUs', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, core_count: 8, model_name: 'A100' });
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([{ id: 100, hostname: 'gpu-node-1' }]),
            });
            utilizationSpy.mockResolvedValue({ free_gpu_count: 1 });

            const result = await service.checkAvailabilityByUtilization(1, 4);

            expect(result.available).toBe(false);
            expect(result.freeCount).toBe(1);
        });

        test('should skip nodes with no recent utilization records', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, core_count: 8, model_name: 'A100' });
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([
                    { id: 100, hostname: 'node-stale' },
                    { id: 101, hostname: 'node-active' },
                ]),
            });
            utilizationSpy
                .mockResolvedValueOnce(null) // node-stale: no recent data
                .mockResolvedValueOnce({ free_gpu_count: 6 }); // node-active: has data

            const result = await service.checkAvailabilityByUtilization(1, 2);

            expect(result.available).toBe(true);
            expect(result.freeCount).toBe(6);
            expect(result.totalCount).toBe(8); // Only node-active counted
        });
    });

    describe('checkAvailability', () => {
        test('should delegate to checkAvailabilityByUtilization', async () => {
            const spy = jest.spyOn(service, 'checkAvailabilityByUtilization').mockResolvedValue({
                available: true, freeCount: 4, totalCount: 8, allocatedCount: 4,
            });

            const result = await service.checkAvailability(1, 2);

            expect(spy).toHaveBeenCalledWith(1, 2);
            expect(result.available).toBe(true);
            spy.mockRestore();
        });
    });

    describe('getAcceleratorStats', () => {
        let hwMasterSpy: jest.SpyInstance;
        let hwSpecsSpy: jest.SpyInstance;
        let nodesSpy: jest.SpyInstance;
        let allocationSpy: jest.SpyInstance;

        beforeEach(() => {
            hwMasterSpy = jest.spyOn(HardwareMasterEntity, 'findOne');
            hwSpecsSpy = jest.spyOn(HardwareSpecsEntity, 'find');
            nodesSpy = jest.spyOn(InfraNodesEntity, 'createQueryBuilder');
            allocationSpy = jest.spyOn(InfraHardwareModuleMapperEntity, 'createQueryBuilder');
        });

        afterEach(() => {
            hwMasterSpy.mockRestore();
            hwSpecsSpy.mockRestore();
            nodesSpy.mockRestore();
            allocationSpy.mockRestore();
        });

        test('should return zeroes if hardware master not found', async () => {
            hwMasterSpy.mockResolvedValue(null);

            const result = await service.getAcceleratorStats(999);

            expect(result).toEqual({
                acceleratorId: 999, acceleratorName: 'Unknown', total: 0, allocated: 0, free: 0,
            });
        });

        test('should return zeroes if no specs found', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, model_name: 'A100', core_count: 8 });
            hwSpecsSpy.mockResolvedValue([]);

            const result = await service.getAcceleratorStats(1);

            expect(result).toEqual({
                acceleratorId: 1, acceleratorName: 'A100', total: 0, allocated: 0, free: 0,
            });
        });

        test('should calculate total, allocated, and free correctly', async () => {
            hwMasterSpy.mockResolvedValue({ id: 1, model_name: 'A100', core_count: 4 });
            hwSpecsSpy.mockResolvedValue([{ id: 10 }, { id: 11 }]);
            nodesSpy.mockReturnValue({
                innerJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([
                    { id: 100, hostname: 'n1' },
                    { id: 101, hostname: 'n2' },
                ]),
            });
            allocationSpy.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ total_allocated: '3' }),
            });

            const result = await service.getAcceleratorStats(1);

            expect(result.total).toBe(8); // 2 nodes * 4 core_count
            expect(result.allocated).toBe(3);
            expect(result.free).toBe(5);
        });
    });

    describe('getAllAcceleratorStats', () => {
        let hwMasterFindSpy: jest.SpyInstance;

        beforeEach(() => {
            hwMasterFindSpy = jest.spyOn(HardwareMasterEntity, 'find');
        });

        afterEach(() => {
            hwMasterFindSpy.mockRestore();
        });

        test('should return stats for all hardware masters', async () => {
            hwMasterFindSpy.mockResolvedValue([{ id: 1 }, { id: 2 }]);
            jest.spyOn(service, 'getAcceleratorStats').mockResolvedValue({
                acceleratorId: 1, acceleratorName: 'A100', total: 8, allocated: 2, free: 6,
            });

            const result = await service.getAllAcceleratorStats();

            expect(result).toHaveLength(2);
        });

        test('should return empty array if no hardware masters', async () => {
            hwMasterFindSpy.mockResolvedValue([]);

            const result = await service.getAllAcceleratorStats();

            expect(result).toEqual([]);
        });
    });

    describe('findAvailableNode', () => {
        let hwSpecsSpy: jest.SpyInstance;
        let nodesSpy: jest.SpyInstance;

        beforeEach(() => {
            hwSpecsSpy = jest.spyOn(HardwareSpecsEntity, 'find');
            nodesSpy = jest.spyOn(InfraNodesEntity, 'createQueryBuilder');
        });

        afterEach(() => {
            hwSpecsSpy.mockRestore();
            nodesSpy.mockRestore();
        });

        test('should return null if no specs found', async () => {
            hwSpecsSpy.mockResolvedValue([]);

            const result = await service.findAvailableNode(1, 2);

            expect(result).toBeNull();
        });

        test('should return node if one has enough capacity', async () => {
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                having: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue({ node_id: 100, hostname: 'gpu-node-1' }),
            });

            const result = await service.findAvailableNode(1, 2);

            expect(result).toEqual({ nodeId: 100, hostname: 'gpu-node-1' });
        });

        test('should return null if no node has enough capacity', async () => {
            hwSpecsSpy.mockResolvedValue([{ id: 10 }]);
            nodesSpy.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                innerJoin: jest.fn().mockReturnThis(),
                leftJoin: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                groupBy: jest.fn().mockReturnThis(),
                having: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockResolvedValue(null),
            });

            const result = await service.findAvailableNode(1, 8);

            expect(result).toBeNull();
        });
    });
});
