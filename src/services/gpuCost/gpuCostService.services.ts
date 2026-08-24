import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { CompanyEntity } from "../../entities/companyEntity";
import { GpuCostModel } from "../../database/repository/gpuCost/gpuCost.model";
import { GpuCostDto } from "../../database/repository/gpuCost/gpuCost.dto";
import Database from '../../database/database';

class GpuCostService extends BaseServices {
    constructor(entity: any = CompanyEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): GpuCostModel {
        return new GpuCostModel();
    }

    getDTO(): any {
        return GpuCostDto;
    }

    getModuleName(): string {
        return 'GPU Cost';
    }

    async getMinMaxGpuCost(companyId: number): Promise<{ min_cost: number, max_cost: number }> {
        try {
            if (!companyId) return { min_cost: 0, max_cost: 0 };
            
            const query = `
                SELECT MIN(ppr.psec * 3600) as min_cost, MAX(ppr.psec * 3600) as max_cost
                FROM v0_dev_yotta.company c
                JOIN price_schema.price_plan_rule ppr ON c.price_plan_id = ppr.price_plan_id AND ppr.is_delete = 0
                WHERE c.id = $1 AND c.is_delete = 0 AND ppr.resource_type = 'GPU'
            `;
            const dbConnection = Database.getInstance();
            const result = await dbConnection.executeExternalQuery(query, [companyId]);
            if (result && result.length > 0) {
                return {
                    min_cost: result[0].min_cost ? parseFloat(result[0].min_cost) : 0,
                    max_cost: result[0].max_cost ? parseFloat(result[0].max_cost) : 0
                };
            }
            return { min_cost: 0, max_cost: 0 };
        } catch (error) {
            console.error('Error fetching min max GPU cost:', error);
            throw error;
        }
    }
}

export default GpuCostService;
