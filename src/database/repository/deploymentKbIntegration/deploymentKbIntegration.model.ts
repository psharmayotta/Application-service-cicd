import { InferModel } from '../InferModel/InferModel.model';

export class DeploymentKbIntegrationModel extends InferModel {
    deployment_id: number = 0;
    knowledge_base_id: number = 0;
    is_active: boolean = true;
}
