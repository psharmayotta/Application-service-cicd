import { BaseServices } from "../baseService.services";
import { TrainingWeightsEntity } from "../../entities/trainingWeightsEntity";
import { TrainingWeightsModel } from "../../database/repository/trainingWeights/trainingWeights.model";
import { TrainingWeightsDto } from "../../database/repository/trainingWeights/trainingWeights.dto";
import { UPLOAD_TRAINING_WEIGHTS_URL, ModuleType, NotificationType } from "../../config";
import { AwsService } from "../../core/AwsService";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { CloudSecretsEntity } from "../../entities/cloudSecretsEntity";
import CloudSecretsService from "../cloudSecrets/cloudSecretsService.service";
import axios from "axios";
import { WebSocketService } from "../../utils/webSocket/webSocketService";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { NotificationService } from "../notification/notificationService.services";
import { NotificationModel } from "../../database/repository/notification/notification.model";
import { MembersEntity } from "../../entities/membersEntity";

class TrainingWeightsService extends BaseServices {
    constructor(entity: any = TrainingWeightsEntity, awsService: AwsService = new AwsService(), protected notificationService: NotificationService = new NotificationService()) {
        super(entity, awsService);
    }

    getModel(): TrainingWeightsModel {
        return new TrainingWeightsModel();
    }

    getDTO(): any {
        return TrainingWeightsDto;
    }

    getModuleName(): string {
        return "Training Weights";
    }

    override createPostProcess(result: TrainingWeightsModel, model: TrainingWeightsModel): Promise<TrainingWeightsModel> {
        return new Promise(async (resolve, reject) => {
            try {
                // Call third party API
                let cloudProviderName = "";
                if (model.cloud_provider) {
                    const cloudProvider = await CloudProviderEntity.findOneBy({ id: Number(model.cloud_provider) });
                    if (cloudProvider) {
                        cloudProviderName = cloudProvider.name;
                    }
                }

                let secretDetails = [];
                if (model.secret_id) {
                    const cloudSecret = await CloudSecretsEntity.findOneBy({ id: model.secret_id });
                    if (cloudSecret && cloudSecret.secrets) {
                        const secrets = { ...cloudSecret.secrets };
                        // Ensure required fields for external API validation even if not used by provider
                        if (secrets.access_key_id === undefined) secrets.access_key_id = "";
                        if (secrets.secret_access_key === undefined) secrets.secret_access_key = "";
                        secretDetails = [secrets];
                    }
                }

                const payload = {
                    training_id: model.training_id,
                    secret_id: model.secret_id,
                    path: model.path,
                    cloud_provider: cloudProviderName,
                    secret_details: secretDetails,
                    org_id: model.org_id
                };

                // Track secret usage
                if (model.secret_id) {
                    CloudSecretsService.updateSecretLastUsed(model.secret_id, 'Training');
                }

                const response = await axios.post(UPLOAD_TRAINING_WEIGHTS_URL, payload);
                console.log("Third-party API response success:", response.data);

                const training = await ModelTrainingEntity.findOneBy({ id: Number(model.training_id) });
                if (training && training.company_id) {
                    const notificationModel = new NotificationModel();
                    notificationModel.user_id = training.member_id;
                    const member = await MembersEntity.findOneBy({ id: training.member_id });
                    const userName = member ? member.full_name : 'User';
                    notificationModel.message = `${userName} initiated Training Weights export for ${training.name}`;
                    notificationModel.notification_type = 'Created';
                    notificationModel.module_name = ModuleType.TRAINING_WEIGHTS;
                    notificationModel.is_readed = false;
                    notificationModel.company_id = training.company_id;
                    await this.notificationService.createRecord(notificationModel, null);
                }

                resolve(result);
            } catch (error) {
                if (axios.isAxiosError(error) && error.response) {
                    console.error("Error in TrainingWeightsService createPostProcess - Status:", error.response.status);
                    console.error("Error Details:", JSON.stringify(error.response.data, null, 2));
                } else {
                    console.error("Error in TrainingWeightsService createPostProcess:", error);
                }
                reject(error);
            }
        });
    }

    async updateStatus(model: TrainingWeightsModel): Promise<any> {
        try {
            const result = await this.entity.findOneBy({ training_id: model.training_id });
            if (result) {
                await this.entity.update({ id: result.id }, { status: model.status });
                const updatedResult = await this.entity.findOneBy({ id: result.id });
                const training = await ModelTrainingEntity.findOneBy({ id: Number(model.training_id) });

                if (training && training.company_id) {
                    await WebSocketService.pushMessageToCompany(training.company_id.toString(), {
                        module: ModuleType.TRAINING_WEIGHTS,
                        entity: updatedResult
                    });

                    if (model.status.toUpperCase() === 'SUCCESS' || model.status.toUpperCase() === 'FAILED') {
                        const notificationModel = new NotificationModel();
                        notificationModel.user_id = training.member_id;
                        const member = await MembersEntity.findOneBy({ id: training.member_id });
                        const userName = member ? member.full_name : 'User';
                        const statusText = model.status.toUpperCase() === 'SUCCESS' ? 'uploaded successfully' : 'failed to upload';
                        notificationModel.message = `Training Weights for ${training.name} ${statusText}`;
                        notificationModel.notification_type = 'Updated'
                        notificationModel.module_name = ModuleType.TRAINING_WEIGHTS;
                        notificationModel.is_readed = false;
                        notificationModel.company_id = training.company_id;
                        await this.notificationService.createRecord(notificationModel, null);
                    }
                }

                return "Status Updated Successfully";
            } else {
                throw new Error("Record not found");
            }
        } catch (error) {
            console.error("Error in TrainingWeightsService updateStatus:", error);
            throw error;
        }
    }
}

export default TrainingWeightsService;
