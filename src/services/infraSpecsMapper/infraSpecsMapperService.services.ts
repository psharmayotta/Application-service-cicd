import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { InfraSpecsMapperEntity } from "../../entities/infraSpecsMapperEntity";
import { FileObject } from "../../core/FileModel";
import { InfraSpecsMapperDto } from "../../database/repository/infraSpecsMapper/infraSpecsMapper.dto";
import { InfraSpecsMapperModel } from "../../database/repository/infraSpecsMapper/infraSpecsMapper.model";

class InfraSpecsMapperService extends BaseServices {
    constructor(entity: any = InfraSpecsMapperEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): InfraSpecsMapperModel {
        return new InfraSpecsMapperModel()
    }

    getDTO(): any {
        return InfraSpecsMapperDto;
    }

    getModuleName(): string {
        return 'Infra Specs Mapper';
    }

    override createPreProcess(model: InfraSpecsMapperModel, files: FileObject[] | null): Promise<InfraSpecsMapperModel> {
        return new Promise<any>(async (resolve, reject) => {
            try {
                const infraSpecsMapperExist = await this.entity.findOneBy({
                    node_id: model.node_id, hardware_specs_id: model.hardware_specs_id, is_delete: 0
                });
                model.id = infraSpecsMapperExist ? infraSpecsMapperExist.id : null;
                resolve(this.transformModel(model));
            } catch (error) {
                console.log('InfraSpecsMapperService createPreProcess error: ', error);
                reject(error);
            }
        });
    }
}

export default InfraSpecsMapperService;