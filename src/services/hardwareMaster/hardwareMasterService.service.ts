import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { HardwareMasterEntity } from "../../entities/hardwareMasterEntity";
import { HardwareMasterModel } from "../../database/repository/hardwareMaster/hardwareMaster.model";
import { HardwareMasterDto } from "../../database/repository/hardwareMaster/hardwareMaster.dto";
import { Pagination } from "../../core/InferParams";
import * as CryptoJS from "crypto-js";
import { Model } from "../../database/repository/model/model.model";
import Database from "../../database/database";

class HardwareMasterService extends BaseServices {
    constructor(entity: any = HardwareMasterEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): HardwareMasterModel {
        return new HardwareMasterModel();
    }

    getDTO() {
        return HardwareMasterDto;
    }

    createPreProcess(model: HardwareMasterModel, files: any[] | null): Promise<HardwareMasterModel> {
        return new Promise<HardwareMasterModel>(async (resolve, reject) => {
            try {
                resolve(this.transformModel(model));
            } catch (error) {
                reject(error);
            }
        });
    }

    override transformModel(model: HardwareMasterModel): HardwareMasterModel {
        return model;
    }

    async prepareQuery(param: Pagination): Promise<any> {
        try {
            const query = this.entity.createQueryBuilder('e')
                .select('*')
                .where('e.is_delete = 0');

            if (param.filter) {
                // param.filter is likely an object based on InferParams, but sometimes passed as JSON string in query params
                // If it's coming from controller via BaseController, it might be parsed.
                // Let's assume it's handled by BaseController or we check type.
                const filter: any = typeof param.filter === 'string' ? JSON.parse(param.filter) : param.filter;

                if (filter.component_type) {
                    query.andWhere('e.component_type = :component_type', { component_type: filter.component_type });
                }
            }

            if (param.sortBy && param.sortType) {
                query.orderBy(`e.${param.sortBy}`, param.sortType.toUpperCase() as "ASC" | "DESC");
            }

            if (param.pageSize && param.pageNumber !== undefined) {
                query.limit(param.pageSize).offset(param.pageNumber * param.pageSize);
            }

            const results = await query.getRawMany();

            const companyId = param.company_id;
            const priceMap = new Map<number, number>();

            if (companyId) {
                try {
                    const priceQuery = `
                        SELECT ppr.resource_id, ppr.psec
                        FROM v0_dev_yotta.company c
                        INNER JOIN price_schema.price_plan_rule ppr 
                            ON c.price_plan_id = ppr.price_plan_id 
                        WHERE c.id = $1 
                        AND c.is_delete = 0 
                        AND ppr.is_delete = 0
                    `;
                    const dbConnection = Database.getInstance();
                    const priceResult = await dbConnection.executeExternalQuery(priceQuery, [companyId]);
                    if (priceResult && Array.isArray(priceResult)) {
                        priceResult.forEach((row: any) => {
                            priceMap.set(Number(row.resource_id), parseFloat(row.psec) * 3600);
                        });
                    }
                } catch (err) {
                    console.error("Error fetching hardware prices for company:", err);
                }
            }

            // Add hashId and dynamically calculated hourly price
            results.forEach((record: any) => {
                if (record.id) {
                    record.hashId = CryptoJS.MD5(record.id.toString()).toString();
                    if (companyId && priceMap.has(Number(record.id))) {
                        record.pricePerUnit = priceMap.get(Number(record.id));
                    } else {
                        record.pricePerUnit = 0;
                    }
                }
            });

            return results;
        } catch (error) {
            console.log('-----HardwareMasterService prepareQuery-----', error);
            throw error;
        }
    }
}

export default HardwareMasterService;
