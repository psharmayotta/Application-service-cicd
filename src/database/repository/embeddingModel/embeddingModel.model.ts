import { InferModel } from '../InferModel/InferModel.model';

export class EmbeddingModelModel extends InferModel {
    name: string = '';
    description: string | null = null;
    model_code: string | null = null;
    default_vector_dimensions: number = 264;
    icon: string | null = null;
    status: boolean = true;
    decryptToken: any = null;
    model_max: number | null = null;
    safe_max: number | null = null;
    recommended_chunk: string | null = null;
    max_overlap: number | null = null;
}
