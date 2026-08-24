export class EvaluationTaskModel {
    id: number = 0;
    name: string = "";
    description: string = "";
    task_type: string = ""; // text_generation, summarization, qa, etc.
    category: string = ""; // NLP, Vision, Audio
    category_id: number = null;
    required_metrics: any = null; // { accuracy: true, latency: true, etc. }
    sample_input: any = null; // Example input for task
    expected_output_format: string = "";
    difficulty_level: string = ""; // easy, medium, hard
    estimated_tokens: number = 0;
    is_active: boolean = true;
    icon: string = "";
    created_at: Date = new Date();
    modified_at: Date = new Date();
    is_delete: number = 0;
}
