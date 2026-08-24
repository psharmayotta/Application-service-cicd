import { InferModel } from "../InferModel/InferModel.model";

export class Guardrails extends InferModel {
    company_id: number = 0;
    member_id: number = 0;
    guardrail_name: string = "";
    description: string = "";
    model_category_id: number = 0;
    configure_filters: any = null;
    prompt_injection: boolean = false;
    content_moderation: boolean = false;
    topic_policy: boolean = false;
    word_policy: boolean = false;
    pii_policy: boolean = false;
    image_content: boolean = false;
    blocked_input_message: string = "";
    blocked_output_message: string = "";
    decryptToken: any = null;
}
