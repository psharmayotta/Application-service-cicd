import { InferModel } from '../InferModel/InferModel.model';

export class DeploymentKbListingModel extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    search_text: string = '';
    decryptToken: any = null;
}
