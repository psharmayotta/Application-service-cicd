import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { HardwareSpecsEntity } from "../../entities/hardwareSpecsEntity";
import { CloudFilter, Pagination } from "../../core/InferParams";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { Brackets, In } from "typeorm";
import { CloudZoneEntity } from "../../entities/cloudZoneEntity";
import { CloudRegionEntity } from "../../entities/cloudRegionEntity";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { HardwareComponentType } from "../../config";
import { ModelEntity } from "../../entities/modelEntity";
import { HardwareSpecsDto } from "../../database/repository/hardwareSpecs/hardwareSpecs.dto";
import { HardwareSpecsModel } from "../../database/repository/hardwareSpecs/hardwareSpecs.model";
import { InfraHardwareModuleMapperEntity } from "../../entities/infraHardwareModuleMapperEntity";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { InfraSpecsMapperEntity } from "../../entities/infraSpecsMapperEntity";

class HardwareSpecsService extends BaseServices {
    constructor(entity: any = HardwareSpecsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): HardwareSpecsModel {
        return new HardwareSpecsModel()
    }

    getDTO(): any {
        return HardwareSpecsDto;
    }

    getModuleName(): string {
        return 'Accelerator';
    }

    getGolbalSearchColumns(): string[] {
        return [
            'main.model_name',
            'main.manufacturer'
        ]
    }

    override postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result && result.length > 0) {
                    // Extract the cloud provider, zone, and region IDs from the result
                    const cloudProviderIds: number[] = result.map((item: any) => item.cloud_provider_id);
                    const cloudZoneIds: number[] = result.map((item: any) => item.zone_id);
                    const cloudRegionIds: number[] = result.map((item: any) => item.region_id);
                    const hardwareMasterIds: number[] = result.map((item: any) => item.hardware_master_id)

                    // Remove duplicates using Set
                    const uniqueCloudProviderIds: number[] = [...new Set(cloudProviderIds)];
                    const uniqueCloudZoneIds: number[] = [...new Set(cloudZoneIds)];
                    const uniqueCloudRegionIds: number[] = [...new Set(cloudRegionIds)];
                    const uniqueHardwareMasterIds: number[] = [...new Set(hardwareMasterIds)];

                    const [cloudProviderData, cloudZoneData, cloudRegionData, hardwareMasterData] = await Promise.all([
                        CloudProviderEntity.findBy({ id: In(uniqueCloudProviderIds), is_delete: 0 }),
                        CloudZoneEntity.findBy({ id: In(uniqueCloudZoneIds), is_delete: 0 }),
                        CloudRegionEntity.findBy({ id: In(uniqueCloudRegionIds), is_delete: 0 }),
                        HardwareMasterEntity.findBy({ id: In(uniqueHardwareMasterIds), is_delete: 0 })
                    ]);

                    result.forEach((item: any) => {
                        const cloudProvider = cloudProviderData.find((cp: any) => cp.id === item.cloud_provider_id);
                        const cloudZone = cloudZoneData.find((cz: any) => cz.id === item.zone_id);
                        const cloudRegion = cloudRegionData.find((cr: any) => cr.id === item.region_id);
                        const hardwareMaster = hardwareMasterData.find((hm: any) => hm.id === item.hardware_master_id)
                        item.component_type = hardwareMaster ? hardwareMaster.component_type : null
                        item.model_name = hardwareMaster ? hardwareMaster.model_name : ''
                        item.manufacturer = hardwareMaster ? hardwareMaster.manufacturer : ''
                        item.core_count = hardwareMaster ? hardwareMaster.core_count : null
                        item.thread_count = hardwareMaster ? hardwareMaster.thread_count : null
                        item.clock_speed_ghz = hardwareMaster ? hardwareMaster.clock_speed_ghz : null
                        item.vram_size_gb = hardwareMaster ? Number(hardwareMaster.vram_size_gb) : null
                        item.vram_type = hardwareMaster ? hardwareMaster.vram_type : ''
                        item.storage_capacity_gb = hardwareMaster ? hardwareMaster.storage_capacity_gb : null
                        item.storage_type = hardwareMaster ? hardwareMaster.storage_type : ''
                        item.cloud_provider_name = cloudProvider ? cloudProvider.name : null;
                        item.cloud_zone_name = cloudZone ? cloudZone.name : null;
                        item.cloud_region_name = cloudRegion ? cloudRegion.name : null;
                    });
                }
                resolve(result);
            } catch (error) {
                console.log('--hardwareSpecsService.postProcessAfterGetData--', error);
                reject(error);
            }
        });
    }

    // fetch only that GPU that are assigned to any machine along with module and cloud provider
    override prepareQuery(param: CloudFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (param.cloud_provider_id === undefined || param.cloud_provider_id === null || typeof param.cloud_provider_id !== 'number') {
                    return reject('E10027')
                }
                if (param.module_id === undefined || param.module_id == null || typeof param.module_id !== 'number') {
                    return reject('E10036')
                }
                const result = await this.entity
                    .createQueryBuilder("h")
                    .select([
                        'h.id as id',
                        'h.hardware_master_id as hardware_master_id',
                        'hm.component_type as component_type',
                        'hm.model_name as model_name',
                        'hm.manufacturer as manufacturer',
                        'hm.core_count as core_count',
                        'hm.thread_count as thread_count',
                        'ihmm.assigned_core as assigned_core',
                        'ihmm.assigned_ram as assigned_ram',
                    ])
                    .innerJoin(InfraHardwareModuleMapperEntity, 'ihmm', 'ihmm.hardware_id = h.id')
                    .innerJoin(InfraSpecsMapperEntity, 'ism', 'ism.hardware_specs_id = h.id')
                    .innerJoin(HardwareMasterEntity, 'hm', 'hm.id = h.hardware_master_id')
                    .where("h.is_delete = :isDelete", { isDelete: 0 })
                    .andWhere("hm.component_type = :componentType", { componentType: HardwareComponentType.GPU })
                    .andWhere("h.cloud_provider_id = :cloudProviderId", { cloudProviderId: param.cloud_provider_id })
                    .andWhere("ihmm.module_id = :moduleId", { moduleId: param.module_id })
                    .andWhere('ihmm.is_delete = 0')
                    .andWhere('ism.is_delete = 0')
                    .andWhere('hm.is_delete = 0')
                    .getRawMany();

                for (const item of result) {
                    if (item.model_name === 'H100') {
                        item.price = 332;
                        item.ram = '2TB';
                        item.virtual_ram = 80
                    } else if (item.model_name === 'L40S') {
                        item.price = 186;
                        item.ram = '1TB';
                        item.virtual_ram = 48
                    } else {
                        item.price = null;
                        item.ram = null;
                        item.virtual_ram = null;
                    }
                }
                resolve(result);
            } catch (error) {
                console.log('--hardwareSpecsService.prepareQuery--', error);
                reject(error);
            }
        });
    }

    override async prepareQueryById(param: InferModel): Promise<any> {
        try {
            if (param.id === undefined || param.id === null || typeof param.id !== 'number') {
                return Promise.reject('E10031');
            }
            const record = await this.entity.createQueryBuilder('hardwareSpecs')
                .select([
                    'hardwareSpecs.id as id',
                    'hardwareSpecs.hardware_master_id as hardware_master_id',
                    'hm.component_type as component_type',
                    'hm.model_name as model_name',
                    'hm.manufacturer as manufacturer',
                    'hm.core_count as core_count',
                    'hm.thread_count as thread_count',
                    'hm.clock_speed_ghz as clock_speed_ghz',
                    'hm.vram_size_gb as vram_size_gb',
                    'hm.vram_type as vram_type',
                    'hm.storage_capacity_gb as storage_capacity_gb',
                    'hm.storage_type as storage_type',
                    'hardwareSpecs.interface as interface',
                    'hardwareSpecs.extra_specs as extra_specs',
                    'hardwareSpecs.vlan_id as vlan_id',
                    'hardwareSpecs.region_id as region_id',
                    'hardwareSpecs.zone_id as zone_id',
                    'hardwareSpecs.cloud_provider_id as cloud_provider_id',
                    'cloudProvider.name AS cloud_provider_name',
                    'cloudZone.name AS cloud_zone_name',
                    'cloudRegion.name AS cloud_region_name',
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'hardwareSpecs.cloud_provider_id = cloudProvider.id')
                .innerJoin(CloudZoneEntity, 'cloudZone', 'hardwareSpecs.zone_id = cloudZone.id')
                .innerJoin(CloudRegionEntity, 'cloudRegion', 'hardwareSpecs.region_id = cloudRegion.id')
                .innerJoin(HardwareMasterEntity, 'hm', 'hm.id = hardwareSpecs.hardware_master_id')
                .where('hardwareSpecs.id = :id', { id: param.id })
                .andWhere('hardwareSpecs.is_delete = 0')
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('cloudZone.is_delete = 0')
                .andWhere('cloudRegion.is_delete = 0')
                .andWhere('hm.is_delete = 0')
                .getRawOne();

            return Promise.resolve(record);
        } catch (error) {
            console.log('--hardwareSpecsService.prepareQueryById--', error);
            return Promise.reject(error);
        }

    }

}

export default HardwareSpecsService;