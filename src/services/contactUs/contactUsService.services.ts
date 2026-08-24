import { AwsService } from '../../core/AwsService';
import { FileObject } from '../../core/FileModel';
import { CloudFilter } from '../../core/InferParams';
import { ContactUsDto } from '../../database/contactUs/contactUs.dto';
import { ContactUsModel } from '../../database/contactUs/contactUsModel.model';
import { ContactUsEntity } from '../../entities/contactUsEntity';
import { BaseServices } from '../baseService.services';

class ContactUsService extends BaseServices {
    constructor(entity: any = ContactUsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ContactUsModel {
        return new ContactUsModel();
    }

    getDTO(): any {
        return ContactUsDto;
    }

    getModuleName(): string {
        return 'Contact us';
    }

    override async createPreProcess(model: ContactUsModel, files: FileObject[] | null): Promise<ContactUsModel> {
        return new Promise<ContactUsModel>(async (resolve, reject) => {
            try {
                if (Array.isArray(model.model_name)) {
                    const modelNames = model.model_name;
                    if (modelNames.length > 0) {
                        model.model_name = modelNames[0];
                        for (let i = 1; i < modelNames.length; i++) {
                            const newModel = new ContactUsModel();
                            Object.assign(newModel, model);
                            newModel.id = null;
                            newModel.model_name = modelNames[i];
                            await this.entity.save(newModel);
                        }
                    }
                }
                return resolve(model);
            } catch (error) {
                return reject(error);
            }
        });
    }

    override async prepareQuery(param: CloudFilter): Promise<any> {
        try {

            return Promise.resolve(param);
        } catch (error) {
            console.log('-----CloudProviderService prepareQuery-----', error);
            return Promise.reject(error)
        }
    }
}

export default ContactUsService;
