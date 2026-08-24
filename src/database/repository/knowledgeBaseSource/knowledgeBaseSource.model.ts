import { InferModel } from '../InferModel/InferModel.model';

export class KnowledgeBaseSourceModel extends InferModel {
    name: string = '';
    description: string | null = null;
    type: string = '';
    icon: string | null = null;
    status: boolean = true;
}
