import { AwsService } from "../../core/AwsService";
import Database from "../../database/database";
import { MyModelDto } from "../../database/repository/MyModel/mymodel.dto";
import { MyModelModel } from "../../database/repository/MyModel/mymodel.model";
import { In } from "typeorm";
import { ModelEntity } from "../../entities/modelEntity";
import { NodeGroupsEntity } from "../../entities/nodeGroupsEntity";
import { BaseServices } from "../baseService.services";
import DeploymentService from "../deployments/deploymentService.services";

export class DashboardService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): MyModelModel {
        return new MyModelModel();
    }

    getDTO(): any {
        return MyModelDto;
    }

    getModuleName(): string {
        return 'Dashboard';
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const db = Database.getInstance();
            const companyId = param.company_id;

            if (!companyId) {
                return { records: [] };
            }

            const selectSql = `
                WITH model_counts AS (
                    SELECT COUNT(*)::int as count FROM model.model_training WHERE is_delete = 0 AND company_id = ${companyId}
                ),
                dataset_counts AS (
                    SELECT COUNT(*)::int as count FROM model.data_sets WHERE is_delete = 0 AND company_id = ${companyId}
                ),
                deployment_counts AS (
                    SELECT COUNT(*)::int as count FROM infra_schema.infra_allocation WHERE is_delete = 0 AND company_id = ${companyId}
                ),
                mymodel_counts AS (
                    SELECT COUNT(*)::int as count FROM model.model WHERE is_delete = 0 AND company_id = ${companyId}
                ),
                recent_deployments AS (
                    SELECT 
                        ia.*, 
                        m.name as model_name, 
                        mem.full_name as member_name,
                        mem.email as created_by_email,
                        ia.gpu_count_per_pod as gpu_count,
                        ia.gpu_count_per_pod as accelerator_count,
                        hm.model_name as gpu_name,
                        hm.model_name as accelerator_name,
                        hm.manufacturer,
                        mt.name as model_type,
                        pd.status as status
                    FROM infra_schema.infra_allocation ia
                    LEFT JOIN model.model m ON ia.module_id = m.id
                    LEFT JOIN v0_dev_yotta.members mem ON ia.user_id = mem.id
                    LEFT JOIN infra_schema.hardware_master hm ON  m.accelerator_id = hm.id
                    LEFT JOIN model.model_task mt ON m.model_task_id = mt.id
                    LEFT JOIN (
                        SELECT pd1.infra_allocation_id,
                        (SELECT pd2.status 
                         FROM infra_schema.pod_details pd2 
                         WHERE pd2.infra_allocation_id = pd1.infra_allocation_id AND pd2.is_delete = 0 
                         ORDER BY CASE pd2.status 
                            WHEN 'READY' THEN 7 
                            WHEN 'START' THEN 6 
                            WHEN 'PENDING' THEN 5 
                            WHEN 'FAILED' THEN 4 
                            WHEN 'PAUSED' THEN 3 
                            WHEN 'DELETED' THEN 2 
                            WHEN 'END' THEN 1 
                            ELSE 0 
                         END DESC, pd2.id DESC LIMIT 1) as status
                        FROM infra_schema.pod_details pd1
                        WHERE pd1.is_delete = 0
                        GROUP BY pd1.infra_allocation_id
                    ) pd ON ia.id = pd.infra_allocation_id
                    WHERE ia.is_delete = 0 AND ia.company_id = ${companyId}
                    ORDER BY ia.created_at DESC LIMIT 3
                ),
                recent_trainings AS (
                    SELECT 
                        mt.*, 
                        mem.full_name as member_name,
                        mem.email as created_by_email,
                        m.name as model_name,
                        ds.name as dataset_name,
                        t_mt.name as model_type
                    FROM model.model_training mt
                    LEFT JOIN v0_dev_yotta.members mem ON mt.member_id = mem.id
                    LEFT JOIN model.model m ON mt.model_id = m.id
                    LEFT JOIN model.data_sets ds ON mt.dataset_id = ds.id
                    LEFT JOIN model.model_task t_mt ON m.model_task_id = t_mt.id
                    WHERE mt.is_delete = 0 AND mt.company_id = ${companyId} 
                    ORDER BY mt.created_at DESC LIMIT 3
                ),
                recent_batch_inference AS (
                    SELECT 
                        bi.*, 
                        mem.full_name as member_name,
                        mem.email as created_by_email,
                        m.name as model_name,
                        ds.name as dataset_name,
                        bij.status as status
                    FROM batch_inference.batch_inference bi
                    LEFT JOIN v0_dev_yotta.members mem ON bi.member_id = mem.id
                    LEFT JOIN model.model m ON bi.base_model_id = m.id
                    LEFT JOIN model.data_sets ds ON bi.dataset_id::int = ds.id
                    LEFT JOIN (
                        SELECT DISTINCT ON (inference_id) inference_id, status
                        FROM batch_inference.batch_inference_job
                        WHERE is_delete = 0
                        ORDER BY inference_id, created_at DESC
                    ) bij ON bi.id = bij.inference_id
                    WHERE bi.is_delete = 0 AND bi.company_id = ${companyId} 
                    ORDER BY bi.created_at DESC LIMIT 3
                ),
                my_models AS (
                    SELECT 
                        m.*, 
                        cp.name as model_source_name,
                        cp.cloud_provider_image, 
                        hm.manufacturer, 
                        mc.name as model_class_name, 
                        q.name as quantization_name,
                        hm.model_name as gpu_name,
                        mt.name as model_type,
                        m.contex as token_limit,
                        mem.email,
                        mem.full_name as member_name,
                        0 as cost
                    FROM model.model m
                    LEFT JOIN v0_dev_yotta.members mem ON m.member_id = mem.id
                    LEFT JOIN infra_schema.cloud_provider cp ON m.cloud_provider_id = cp.id
                    LEFT JOIN infra_schema.hardware_specs hs ON m.accelerator_id = hs.id
                    LEFT JOIN infra_schema.hardware_master hm ON hs.hardware_master_id = hm.id
                    LEFT JOIN model.model_class mc ON m.model_class_id = mc.id
                    LEFT JOIN model.model_task mt ON m.model_task_id = mt.id
                    LEFT JOIN model.quantization q ON m.quantization_id = q.id
                    WHERE m.is_delete = 0 AND m.company_id = ${companyId}
                    ORDER BY m.created_at DESC LIMIT 3
                ),
                popular_models AS (
                    SELECT 
                        m.*, 
                        mt.name as model_task_name,
                        mp.model_provider_icon
                    FROM model.model m
                    LEFT JOIN model.model_task mt ON m.model_task_id = mt.id
                    LEFT JOIN model.model_provider mp ON m.model_provider_id = mp.id
                    WHERE m.is_delete = 0 AND m.popular_models = 1
                    ORDER BY m.created_at DESC LIMIT 3
                ),
                wallet_info AS (
                    SELECT balance, currency 
                    FROM price_schema.wallet 
                    WHERE company_id = ${companyId} AND is_delete = 0
                ),
                daily_costs AS (
                    SELECT 
                        TO_CHAR(day_series, 'YYYY-MM-DD') as date,
                        COALESCE(SUM(CASE WHEN reference_type = 'DEPLOYMENT' THEN amount ELSE 0 END), 0) as deployment_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'TRAINING' THEN amount ELSE 0 END), 0) as training_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'PLAYGROUND' THEN amount ELSE 0 END), 0) as playground_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'BENCHMARKING' THEN amount ELSE 0 END), 0) as benchmarking_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'BATCH_INFERENCE' THEN amount ELSE 0 END), 0) as batch_inference_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'KNOWLEDGEBASE' THEN amount ELSE 0 END), 0) as knowledgebase_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'DATASET' THEN amount ELSE 0 END), 0) as dataset_cost,
                        COALESCE(SUM(amount), 0) as total_spend
                    FROM (
                        SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date as day_series
                    ) d
                    LEFT JOIN price_schema.wallet w ON w.company_id = ${companyId}
                    LEFT JOIN price_schema.wallet_transactions wt ON wt.wallet_id = w.id 
                        AND wt.created_at::date = d.day_series
                        AND wt.type = 'DEBIT' 
                        AND wt.status = 'SUCCESS' 
                        AND wt.is_delete = 0
                    GROUP BY day_series
                    ORDER BY day_series DESC
                ),
                cost_metrics AS (
                    SELECT 
                        COALESCE(SUM(CASE WHEN reference_type = 'DEPLOYMENT' THEN amount ELSE 0 END), 0) as deployment_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'TRAINING' THEN amount ELSE 0 END), 0) as training_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'PLAYGROUND' THEN amount ELSE 0 END), 0) as playground_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'BENCHMARKING' THEN amount ELSE 0 END), 0) as benchmarking_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'BATCH_INFERENCE' THEN amount ELSE 0 END), 0) as batch_inference_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'KNOWLEDGEBASE' THEN amount ELSE 0 END), 0) as knowledgebase_cost,
                        COALESCE(SUM(CASE WHEN reference_type = 'DATASET' THEN amount ELSE 0 END), 0) as dataset_cost,
                        COALESCE(SUM(amount), 0) as total_spend
                    FROM price_schema.wallet_transactions wt
                    JOIN price_schema.wallet w ON wt.wallet_id = w.id
                    WHERE w.company_id = ${companyId} 
                    AND wt.type = 'DEBIT'
                    AND wt.status = 'SUCCESS'
                    AND wt.is_delete = 0
                )
                SELECT
                    (SELECT count FROM model_counts) as total_models_trained,
                    (SELECT count FROM dataset_counts) as total_datasets,
                    (SELECT count FROM deployment_counts) as total_deployments,
                    (SELECT count FROM mymodel_counts) as total_mymodels,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM recent_deployments t) as recent_deployments,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM recent_trainings t) as recent_trainings,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM recent_batch_inference t) as recent_batch_inference,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM my_models t) as my_models,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM popular_models t) as popular_models,
                    (
                        SELECT json_build_array(
                            json_build_object(
                                'available_credits', (SELECT balance FROM wallet_info),
                                'currency', (SELECT currency FROM wallet_info),
                                'deployment_cost', (SELECT deployment_cost FROM cost_metrics),
                                'training_cost', (SELECT training_cost FROM cost_metrics),
                                'playground_cost', (SELECT playground_cost FROM cost_metrics),
                                'benchmarking_cost', (SELECT benchmarking_cost FROM cost_metrics),
                                'batch_inference_cost', (SELECT batch_inference_cost FROM cost_metrics),
                                'knowledgebase_cost', (SELECT knowledgebase_cost FROM cost_metrics),
                                'dataset_cost', (SELECT dataset_cost FROM cost_metrics),
                                'total_spend', (SELECT total_spend FROM cost_metrics)
                            )
                        )
                    ) as cost,
                    (SELECT COALESCE(json_agg(t), '[]'::json) FROM daily_costs t) as last_7_days_cost,
                    (
                        NOT EXISTS (SELECT 1 FROM recent_deployments) AND 
                        NOT EXISTS (SELECT 1 FROM recent_trainings) AND 
                        NOT EXISTS (SELECT 1 FROM recent_batch_inference) AND 
                        NOT EXISTS (SELECT 1 FROM my_models)
                    ) as is_new_user
            `;

            const queryResult = await db.executeExternalQuery(selectSql);
            let result: any = {};

            if (Array.isArray(queryResult) && queryResult.length > 0) {
                const rows = (Array.isArray(queryResult) && Array.isArray(queryResult[0])) ? queryResult[0] : queryResult;
                result = rows.length > 0 ? rows[0] : {};

                if (result.my_models && Array.isArray(result.my_models)) {
                    result.my_models = await Promise.all(result.my_models.map(async (model: any) => {
                        model.cloud_provider_image = model.cloud_provider_image
                            ? await this.generateSignedUrl(
                                "cloudProviderMedia",
                                model.cloud_provider_id,
                                model.cloud_provider_image
                            )
                            : "";

                        if (model.model_class_id) {
                            const taskResult = await db.executeExternalQuery(`
                                SELECT mt.name as task_name 
                                FROM model.model m
                                JOIN model.model_task mt ON m.model_task_id = mt.id
                                WHERE m.model_class_id = ${model.model_class_id} AND m.is_delete = 0
                                ORDER BY m.model_rank ASC LIMIT 1
                            `);
                            const rows = (Array.isArray(taskResult) && Array.isArray(taskResult[0])) ? taskResult[0] : taskResult;
                            if (rows && rows.length > 0) {
                                model.model_task_name = rows[0].task_name;
                            }
                        }

                        return model;
                    }));
                }

                if (result.popular_models && Array.isArray(result.popular_models)) {
                    result.popular_models = await Promise.all(result.popular_models.map(async (model: any) => {
                        model.signedUrl_model_image = model.model_provider_icon
                            ? await this.generateSignedUrl(
                                "modelProviderMedia",
                                model.model_provider_id,
                                model.model_provider_icon
                            )
                            : "";
                        return model;
                    }));
                }

                if (result.recent_deployments && Array.isArray(result.recent_deployments)) {
                    result.recent_deployments = await Promise.all(result.recent_deployments.map(async (item: any) => {
                        const config = item.config;
                        if (
                            config &&
                            config.node_groups &&
                            Array.isArray(config.node_groups) &&
                            config.node_groups.length > 0
                        ) {
                            try {
                                const nodeGroups = await NodeGroupsEntity.findBy({
                                    id: In(config.node_groups),
                                });
                                if (nodeGroups && nodeGroups.length > 0) {
                                    item.gpu_name = nodeGroups[0].name;
                                    item.accelerator_name = nodeGroups[0].name;
                                }
                            } catch (err) {
                                console.error("Error fetching node group names in DashboardService:", err);
                            }
                        }
                        DeploymentService.processDeploymentStatus(item);
                        return item;
                    }));
                }
            }

            return result;
        } catch (error) {
            console.error("prepareQuery error:", error);
            return Promise.reject(error);
        }
    }
}
