import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { GuardrailsEntity } from "../../entities/guardrailsEntity";
import { Guardrails } from "../../database/repository/guardrails/guardrails.model";
import { GuardrailsDto } from "../../database/repository/guardrails/guardrails.dto";
import { MembersEntity } from "../../entities/membersEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { Pagination } from "../../core/InferParams";
import { KafkaService } from "../../utils/kafka/KafkaService";
import { KAFKAPRODUCERS } from "../../config";

class GuardrailsService extends BaseServices {
    constructor(
        entity: any = GuardrailsEntity,
        protected awsService: AwsService = new AwsService()
    ) {
        super(entity, awsService);
    }

    getModel(): Guardrails {
        return new Guardrails();
    }

    getDTO(): any {
        return GuardrailsDto;
    }

    getModuleName(): string {
        return "Guardrails";
    }

    override async createPreProcess(model: Guardrails, files: any): Promise<Guardrails> {
        try {
            if (model.decryptToken) {
                model.member_id = model.decryptToken.member_id;
            }
            return Promise.resolve(model);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    override createPostProcess(result: Guardrails, model: Guardrails, files: any): Promise<Guardrails> {
        return new Promise(async (resolve, reject) => {
            try {
                const category = await ModelCategoryEntity.findOneBy({ id: result.model_category_id });
                const model_category_name = category ? category.name : "";

                const kafkaPayload = {
                    id: result.id,
                    company_id: result.company_id,
                    guardrail_name: result.guardrail_name,
                    description: result.description,
                    model_category_id: result.model_category_id,
                    model_category_name: model_category_name,
                    configure_filters: result.configure_filters,
                    blocked_input_message: result.blocked_input_message,
                    blocked_output_message: result.blocked_output_message,
                    action: model.id ? "UPDATE" : "CREATE"
                };

                const kafkaService = KafkaService.getInstance();
                await kafkaService.sendMessage(KAFKAPRODUCERS.GUARDRAILINIT, kafkaPayload);
                console.log(`[Guardrails Kafka] Sent message to dev-guardrail-init topic for guardrail ID: ${result.id}`);

                resolve(result);
            } catch (error) {
                console.error("GuardrailsService createPostProcess error:", error);
                // Resolve to not block the REST API save if Kafka connection has issues.
                resolve(result);
            }
        });
    }

    override async prepareQuery(param: Pagination): Promise<any> {
        try {
            const query = this.entity.createQueryBuilder("gr")
                .leftJoin(MembersEntity, "member", "member.id = gr.member_id")
                .leftJoin(ModelCategoryEntity, "category", "category.id = gr.model_category_id")
                .select([
                    "gr.id as id",
                    "gr.guardrail_name as guardrail_name",
                    "gr.description as description",
                    "gr.configure_filters as configure_filters",
                    "gr.prompt_injection as prompt_injection",
                    "gr.content_moderation as content_moderation",
                    "gr.topic_policy as topic_policy",
                    "gr.word_policy as word_policy",
                    "gr.pii_policy as pii_policy",
                    "gr.image_content as image_content",
                    "gr.blocked_input_message as blocked_input_message",
                    "gr.blocked_output_message as blocked_output_message",
                    "gr.company_id as company_id",
                    "gr.member_id as member_id",
                    "gr.model_category_id as model_category_id",
                    "member.full_name as created_by",
                    "member.profile_picture as profile_picture",
                    "category.name as category_name",
                    "gr.created_at as created_at",
                    "gr.modified_at as modified_at",
                    "gr.is_delete as is_delete"
                ])
                .where("gr.company_id = :companyId", { companyId: param.company_id })
                .andWhere("gr.is_delete = :isDelete", { isDelete: 0 });

            // Global search
            if (param.search_text) {
                const searchText = `%${param.search_text.toLowerCase()}%`;
                query.andWhere(
                    "(LOWER(gr.guardrail_name) LIKE :search",
                    { search: searchText }
                );
            }

            // Category filter
            if ((param as any).category_id) {
                query.andWhere("gr.model_category_id = :categoryId", { categoryId: (param as any).category_id });
            }

            // Toggle filters from UI (passed as an array of active policy names)
            let filterNames: string[] = [];
            const rawFilter = (param as any).configured_filters || (param as any).filter_name || (param as any).configured_filter;
            if (rawFilter) {
                if (Array.isArray(rawFilter)) {
                    filterNames = rawFilter;
                } else if (typeof rawFilter === "string") {
                    filterNames = rawFilter.split(",").map(f => f.trim());
                }
            }

            const toggleFilters = ["prompt_injection", "content_moderation", "topic_policy", "word_policy", "pii_policy", "image_content"];
            const validFilters = filterNames.filter(f => toggleFilters.includes(f));

            if (validFilters.length > 0) {
                const orConditions = validFilters.map(f => `gr.${f} = true`).join(" OR ");
                query.andWhere(`(${orConditions})`);
            }

            query.orderBy("gr.id", "DESC");

            // Get total count
            const total = await query.getCount();

            // Apply pagination safely
            if (param.pageNumber && param.pageNumber > 0 && param.pageSize && param.pageSize > 0) {
                const offset = (param.pageNumber - 1) * param.pageSize;
                query.offset(offset);
                query.limit(param.pageSize);
            }

            const records = await query.getRawMany();

            const processedRecords = await Promise.all(
                records.map(async (rec: any) => {
                    let profilePictureUrl = rec.profile_picture;
                    if (profilePictureUrl && !profilePictureUrl.startsWith("http")) {
                        try {
                            profilePictureUrl = await this.generateSignedUrl("members", rec.member_id, rec.profile_picture);
                        } catch (e) {
                            console.error("Error generating signed URL for profile picture", e);
                            profilePictureUrl = null;
                        }
                    }
                    let activeTogglesCount = 0;
                    const toggleKeys = ["prompt_injection", "content_moderation", "topic_policy", "word_policy", "pii_policy", "image_content"];
                    for (const key of toggleKeys) {
                        if (rec[key] === true || rec[key] === 1 || rec[key] === "true") {
                            activeTogglesCount++;
                        }
                    }

                    return {
                        ...rec,
                        profile_picture: profilePictureUrl,
                        configure_filters: activeTogglesCount
                    };
                })
            );

            return Promise.resolve({
                data: processedRecords,
                pagination: {
                    total,
                    pageSize: param.pageSize,
                    pageNumber: param.pageNumber,
                }
            });
        } catch (error) {
            console.error("GuardrailsService.prepareQuery error:", error);
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: Pagination): Promise<any> {
        try {
            if (!param.id) {
                throw new Error("Guardrail ID is required");
            }
            const record = await this.entity.createQueryBuilder("gr")
                .leftJoinAndSelect(ModelCategoryEntity, "category", "category.id = gr.model_category_id")
                .select([
                    "gr.id as id",
                    "gr.guardrail_name as guardrail_name",
                    "gr.description as description",
                    "gr.configure_filters as configure_filters",
                    "gr.prompt_injection as prompt_injection",
                    "gr.content_moderation as content_moderation",
                    "gr.topic_policy as topic_policy",
                    "gr.word_policy as word_policy",
                    "gr.pii_policy as pii_policy",
                    "gr.image_content as image_content",
                    "gr.blocked_input_message as blocked_input_message",
                    "gr.blocked_output_message as blocked_output_message",
                    "gr.company_id as company_id",
                    "gr.member_id as member_id",
                    "gr.model_category_id as model_category_id",
                    "category.name as category_name",
                    "gr.created_at as created_at",
                    "gr.modified_at as modified_at"
                ])
                .where("gr.id = :id", { id: param.id })
                .andWhere("gr.is_delete = :isDelete", { isDelete: 0 })
                .getRawOne();

            if (!record) {
                throw new Error("Guardrail not found");
            }

            return Promise.resolve(record);
        } catch (error) {
            console.error("GuardrailsService.prepareQueryById error:", error);
            return Promise.reject(error);
        }
    }
}

export default GuardrailsService;
