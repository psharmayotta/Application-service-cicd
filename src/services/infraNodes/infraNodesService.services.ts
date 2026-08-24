import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { InfraNodesEntity } from "../../entities/infraNodesEntity";
import { InfraNodesModel } from "../../database/repository/infraNodes/infraNodes.model";
import { InfraNodesDto } from "../../database/repository/infraNodes/infraNodes.dto";
import { FileObject } from "../../core/FileModel";
import { In, Not } from "typeorm";
import { InfraNodesStatus } from "../../config";
import { InfraSpecsMapperModel } from "../../database/repository/infraSpecsMapper/infraSpecsMapper.model";
import InfraSpecsMapperService from "../infraSpecsMapper/infraSpecsMapperService.services";
import { CloudFilter, Pagination } from "../../core/InferParams";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { CloudZoneEntity } from "../../entities/cloudZoneEntity";
import { CloudRegionEntity } from "../../entities/cloudRegionEntity";
import { HardwareSpecsEntity } from "../../entities/hardwareSpecsEntity";
import { InfraSpecsMapperEntity } from "../../entities/infraSpecsMapperEntity";
import { InferModel } from "../../database/repository/InferModel/InferModel.model";
import { InfraHardwareModuleMapperEntity } from "../../entities/infraHardwareModuleMapperEntity";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";

class InfraNodesService extends BaseServices {
    constructor(entity: any = InfraNodesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InfraNodesModel {
        return new InfraNodesModel()
    }

    getDTO(): any {
        return InfraNodesDto;
    }

    getModuleName(): string {
        return 'Infra Nodes';
    }

    getGolbalSearchColumns(): string[] {
        return ['main.hostname']
    }

    override createPreProcess(model: InfraNodesModel, files: FileObject[] | null): Promise<InfraNodesModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const hostnameCondition = model.id
                    ? { id: Not(model.id), hostname: model.hostname, is_delete: 0 }
                    : { hostname: model.hostname, is_delete: 0 };

                const ipAddressCondition = model.id
                    ? { id: Not(model.id), ip_address: model.ip_address, is_delete: 0 }
                    : { ip_address: model.ip_address, is_delete: 0 };

                const macAddressCondition = model.id
                    ? { id: Not(model.id), mac_address: model.mac_address, is_delete: 0 }
                    : { mac_address: model.mac_address, is_delete: 0 };

                const serialNumberCondition = model.id
                    ? { id: Not(model.id), serial_number: model.serial_number, is_delete: 0 }
                    : { serial_number: model.serial_number, is_delete: 0 };

                const [hostnameExist, ipAddressExist, macAddressExist, serialNumberExist] = await Promise.all([
                    this.entity.findOneBy(hostnameCondition),
                    this.entity.findOneBy(ipAddressCondition),
                    this.entity.findOneBy(macAddressCondition),
                    this.entity.findOneBy(serialNumberCondition),
                ]);

                if (hostnameExist) return reject('E10035');
                if (ipAddressExist) return reject('E10036');
                if (macAddressExist) return reject('E10037');
                if (serialNumberExist) return reject('E10038');

                resolve(this.transformModel(model));
            } catch (error) {
                console.log('InfraNodesService createPreProcess error: ', error);
                reject(error)
            }
        });
    }

    override transformModel(model: InfraNodesModel): any {
        const { mobileExist, ...restModel } = model
        restModel.status = restModel.status ? restModel.status : InfraNodesStatus.AVAILABLE
        restModel.provisioned_by = mobileExist.id
        return restModel;
    }

    override createPostProcess(result: InfraNodesModel, model: InfraNodesModel, files: any): Promise<InfraNodesModel> {
        return new Promise(async (resolve, reject) => {
            try {
                for (const hardware_specs_id of model.hardware_specs_ids) {
                    const infraSpecsMapperModel = new InfraSpecsMapperModel();
                    const infraSpecsMapperService = new InfraSpecsMapperService();
                    infraSpecsMapperModel.node_id = result.id;
                    infraSpecsMapperModel.hardware_specs_id = hardware_specs_id;
                    infraSpecsMapperModel.config_date = new Date();
                    await infraSpecsMapperService.createRecord(infraSpecsMapperModel, null);
                }

                // infraSpecsMapperModel.notes = 
                resolve(result);
            } catch (error) {
                console.log('InfraNodesService createPostProcess error: ', error);
                reject(error);
            }
        });
    }

    override postProcessAfterGetData(result: any, param: Pagination): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (result && result.length > 0) {

                    // Extract the cloud provider, zone, and region IDs from the result
                    const infraNodesIds: number[] = result.map((item: any) => item.id);
                    const cloudProviderIds: number[] = result.map((item: any) => item.cloud_provider_id);
                    const cloudZoneIds: number[] = result.map((item: any) => item.zone_id);
                    const cloudRegionIds: number[] = result.map((item: any) => item.region_id);
                    const provisioned_by_Ids: number[] = result.map((item: any) => item.provisioned_by);

                    // Remove duplicates using Set
                    const uniqueCloudProviderIds: number[] = [...new Set(cloudProviderIds)];
                    const uniqueCloudZoneIds: number[] = [...new Set(cloudZoneIds)];
                    const uniqueCloudRegionIds: number[] = [...new Set(cloudRegionIds)];
                    const uniqueInfraNodesIds: number[] = [...new Set(infraNodesIds)];
                    const uniqueProvisionedByIds: number[] = [...new Set(provisioned_by_Ids)];

                    const [cloudProviderData, cloudZoneData, cloudRegionData, hardwareSpecsData] = await Promise.all([
                        CloudProviderEntity.findBy({ id: In(uniqueCloudProviderIds), is_delete: 0 }),
                        CloudZoneEntity.findBy({ id: In(uniqueCloudZoneIds), is_delete: 0 }),
                        CloudRegionEntity.findBy({ id: In(uniqueCloudRegionIds), is_delete: 0 }),
                        // this.entity.createQueryBuilder('infraNodes')
                        //     .select([
                        //         'infraSpecsMapper.id as id',
                        //         'infraNodes.id as node_id',
                        //         'hardwareSpecs.id as hardware_specs_id',
                        //         'hardwareSpecs.component_type as component_type',
                        //         'hardwareSpecs.model_name as model_name',
                        //         'hardwareSpecs.manufacturer as manufacturer'
                        //     ])
                        //     .innerJoin(InfraSpecsMapperEntity, 'infraSpecsMapper', 'infraSpecsMapper.node_id = infraNodes.id')
                        //     .innerJoin(HardwareSpecsEntity, 'hardwareSpecs', 'hardwareSpecs.id = infraSpecsMapper.hardware_specs_id')
                        //     .where('infraNodes.id IN (:...ids) AND infraNodes.is_delete = 0', { ids: uniqueInfraNodesIds })
                        //     .andWhere('hardwareSpecs.is_delete = 0')
                        //     .getRawMany()
                        this.entity.createQueryBuilder('infraNodes')
                            .select([
                                '"infraSpecsMapper"."id" as id',
                                '"infraNodes"."id" as node_id',
                                '"hardwareSpecs"."id" as hardware_specs_id'
                            ])
                            .innerJoin(InfraSpecsMapperEntity, 'infraSpecsMapper', '"infraSpecsMapper"."node_id" = "infraNodes"."id"')
                            .innerJoin(HardwareSpecsEntity, 'hardwareSpecs', '"hardwareSpecs"."id" = "infraSpecsMapper"."hardware_specs_id"')
                            .where('"infraNodes"."id" IN (:...ids)', { ids: uniqueInfraNodesIds })
                            .andWhere('"infraNodes"."is_delete" = 0')
                            .andWhere('"hardwareSpecs"."is_delete" = 0')
                            .getRawMany()
                    ])

                    result.forEach((item: any) => {
                        const cloudProvider = cloudProviderData.find((cp: any) => cp.id === item.cloud_provider_id);
                        const cloudZone = cloudZoneData.find((cz: any) => cz.id === item.zone_id);
                        const cloudRegion = cloudRegionData.find((cr: any) => cr.id === item.region_id);
                        item.cloud_provider_name = cloudProvider ? cloudProvider.name : null;
                        item.cloud_zone_name = cloudZone ? cloudZone.name : null;
                        item.cloud_region_name = cloudRegion ? cloudRegion.name : null;
                        item.hardware_specs_details = hardwareSpecsData ? hardwareSpecsData : [];
                    });
                }
                resolve(result);
            } catch (error) {
                console.log('--- InfraNodesService postProcessAfterGetData error: ', error);
                reject(error);
            }
        });
    }

    async prepareQueryById(param: InferModel): Promise<any> {
        try {
            if (param.id === undefined || param.id === null || typeof param.id !== 'number') {
                return Promise.reject('E10031');
            }
            const record = await this.entity.createQueryBuilder('infraNodes')
                .select([
                    'infraNodes.id as id',
                    'infraNodes.hostname as hostname',
                    'infraNodes.location as location',
                    'infraNodes.rack_id as rack_id',
                    'infraNodes.ip_address as ip_address',
                    'infraNodes.mac_address as mac_address',
                    'infraNodes.serial_number as serial_number',
                    'infraNodes.status as status',
                    'infraNodes.cloud_provider_id as cloud_provider_id',
                    'cloudProvider.name as cloud_provider_name',
                    'infraNodes.zone_id as zone_id',
                    'cloudZone.name as cloud_zone_name',
                    'infraNodes.region_id as region_id',
                    'cloudRegion.name as cloud_region_name',
                    'infraNodes.owner_project_id as owner_project_id',
                    'infraNodes.provisioned_by as provisioned_by',
                ])
                .innerJoin(CloudProviderEntity, 'cloudProvider', 'infraNodes.cloud_provider_id = cloudProvider.id')
                .innerJoin(CloudZoneEntity, 'cloudZone', 'infraNodes.zone_id = cloudZone.id')
                .innerJoin(CloudRegionEntity, 'cloudRegion', 'infraNodes.region_id = cloudRegion.id')
                .where('infraNodes.id = :id', { id: param.id })
                .andWhere('infraNodes.is_delete = 0')
                .andWhere('cloudProvider.is_delete = 0')
                .andWhere('cloudZone.is_delete = 0')
                .andWhere('cloudRegion.is_delete = 0')
                .andWhere('users.is_delete = 0')
                .getRawOne();

            if (record) {
                const hardwareSpecsData = await this.entity.createQueryBuilder('infraNodes')
                    .select([
                        'infraSpecsMapper.id as id',
                        'infraNodes.id as node_id',
                        'hardwareSpecs.id as hardware_specs_id',
                        'hm.component_type as component_type',
                        'hm.model_name as model_name',
                        'hm.manufacturer as manufacturer'
                    ])
                    .innerJoin(InfraSpecsMapperEntity, 'infraSpecsMapper', 'infraSpecsMapper.node_id = infraNodes.id')
                    .innerJoin(HardwareSpecsEntity, 'hardwareSpecs', 'hardwareSpecs.id = infraSpecsMapper.hardware_specs_id')
                    .innerJoin(HardwareMasterEntity, 'hm', 'hm.id = hardwareSpecs.hardware_master_id')
                    .where('infraNodes.id = :id AND infraNodes.is_delete = 0', { id: record.id })
                    .andWhere('hardwareSpecs.is_delete = 0')
                    .andWhere('infraSpecsMapper.is_delete = 0')
                    .andWhere('hm.is_delete = 0')
                    .getRawMany();

                record.hardware_specs_details = hardwareSpecsData ? hardwareSpecsData : [];
            }

            return Promise.resolve(record);
        } catch (error) {
            console.log('InfraNodesService prepareQueryById error: ', error);
            return Promise.reject(error);
        }
    }

    override prepareQuery(param: CloudFilter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (param.hardware_id === undefined || param.hardware_id === null || typeof param.hardware_id !== 'number') {
                    return reject('E10035')
                }

                if (!param.assigned_core) {
                    return reject('E10038')
                }

                const result = await this.entity
                    .createQueryBuilder("n")
                    .distinct(true)
                    .select([
                        "n.id AS node_id",
                        "n.hostname AS hostname",
                        "n.ip_address AS ip_address",
                        "n.location AS location",
                        "hs.id AS hardware_id",
                        'hs.hardware_master_id as hardware_master_id',
                        "hm.model_name AS model_name",
                        "hm.component_type AS component_type",
                        "hm.core_count AS core_count",
                        "ihmm.assigned_core AS assigned_core",
                        "ihmm.assigned_storage AS assigned_storage",
                    ])
                    .innerJoin(InfraSpecsMapperEntity, "ism", "ism.node_id = n.id AND ism.is_delete = 0")
                    .innerJoin(HardwareSpecsEntity, "hs", "hs.id = ism.hardware_specs_id AND hs.is_delete = 0")
                    .innerJoin(HardwareMasterEntity, 'hm', 'hm.id = hs.hardware_master_id')
                    .leftJoin(InfraHardwareModuleMapperEntity, "ihmm", "ihmm.hardware_id = hs.id AND ihmm.is_delete = 0")
                    .where("n.is_delete = :isDelete", { isDelete: 0 })
                    .andWhere("hs.id = :hardwareId", { hardwareId: param.hardware_id })
                    .andWhere('ihmm.assigned_core = :assignedCore', { assignedCore: param.assigned_core })
                    .andWhere('hm.is_delete = 0')
                    .getRawMany();

                resolve(result);
            } catch (error) {
                console.log('-----InfraNodesService.prepareQuery------', error);
                reject(error)
            }
        })
    }


}

export default InfraNodesService;