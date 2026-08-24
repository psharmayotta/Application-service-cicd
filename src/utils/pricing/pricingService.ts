import Database from "../../database/database";

export class PricingService {
    /**
     * Fetch the price per second for a specific accelerator from the company's price plan.
     * @param companyId Company ID
     * @param acceleratorId Accelerator ID (hardware_master_id)
     * @returns Price per second (psec)
     */
    public static async getPricePerSec(companyId: number, acceleratorId: number): Promise<number> {
        try {
            if (!companyId || !acceleratorId) return 0;

            const query = `
                SELECT ppr.psec
                FROM v0_dev_yotta.company c
                LEFT JOIN price_schema.price_plan_rule ppr 
                    ON c.price_plan_id = ppr.price_plan_id 
                AND ppr.is_delete = 0
                WHERE c.id = ${companyId} 
                AND c.is_delete = 0
                AND ppr.resource_id = ${acceleratorId}
                LIMIT 1
            `;
            const dbConnection = Database.getInstance();
            const result = await dbConnection.executeExternalQuery(query);
            return result?.[0]?.psec ? parseFloat(result[0].psec) : 0;
        } catch (error) {
            console.error(`Error fetching price for company ${companyId}, accelerator ${acceleratorId}:`, error);
            return 0;
        }
    }
}
