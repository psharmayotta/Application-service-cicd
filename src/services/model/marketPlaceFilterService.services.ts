import { AwsService } from "../../core/AwsService";
import Database from "../../database/database";
import { ModelDto } from "../../database/repository/model/model.dto";
import { Model } from "../../database/repository/model/model.model";
import { ModelEntity } from "../../entities/modelEntity";
import { BaseServices } from "../baseService.services";

class MarketPlaceFilterService extends BaseServices {
    constructor(entity: any = ModelEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): Model {
        return new Model()
    }

    getDTO(): any {
        return ModelDto;
    }

    getModuleName(): string {
        return 'Marketplace Filter';
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const dbConnection = Database.getInstance();
            let skip = 0;
            let paginationCondition = "";

            if (param.pageNumber > 0) {
                skip = (param.pageNumber - 1) * param.pageSize;
                paginationCondition = `LIMIT ${param.pageSize} OFFSET ${skip}`;
            }

            const selectQuery = `
                SELECT
                    (
                        SELECT json_agg(library ORDER BY library.id ASC)
                        FROM model.model_libararies library
                        WHERE library.is_delete = 0
                    ) AS libraries,

                    (
                        SELECT json_agg(task ORDER BY task.id ASC)
                        FROM model.model_task task
                        WHERE task.is_delete = 0
                    ) AS task,

                    (
                        SELECT json_agg(publisher ORDER BY publisher.id ASC)
                        FROM model.model_provider publisher
                        WHERE publisher.is_delete = 0
                    ) AS publisher
            `;

            const result = await dbConnection.executeExternalQuery(selectQuery, []);
            const data = result[0] || {};

            // libraries
            if (Array.isArray(data.libraries) && data.libraries.length > 0) {
                for (const lib of data.libraries) {
                    if (lib.model_libararies_icon) {
                        lib.model_libararies_icon_signed_url =
                            await this.generateSignedUrl(
                                'modelLibarariesMedia',
                                lib.id,
                                lib.model_libararies_icon
                            );
                    } else {
                        lib.model_libararies_icon_signed_url = null;
                    }
                }
            }

            // tasks
            if (Array.isArray(data.task) && data.task.length > 0) {
                for (const task of data.task) {
                    if (task.model_task_icon) {
                        task.model_task_icon_signed_url =
                            await this.generateSignedUrl(
                                'modelTaskMedia',
                                task.id,
                                task.model_task_icon
                            );
                    } else {
                        task.model_task_icon_signed_url = null;
                    }
                }
            }

            // publishers
            if (Array.isArray(data.publisher) && data.publisher.length > 0) {
                for (const pub of data.publisher) {
                    if (pub.model_provider_icon) {
                        pub.model_provider_icon_signed_url =
                            await this.generateSignedUrl(
                                'modelProviderMedia',
                                pub.id,
                                pub.model_provider_icon
                            );
                    } else {
                        pub.model_provider_icon_signed_url = null;
                    }
                }
            }

            const totalRecords = {
                library: data.libraries?.length || 0,
                task: data.task?.length || 0,
                publisher: data.publisher?.length || 0
            };

            return { result: data, totalRecords };

        } catch (error) {
            console.error("prepareQuery error:", error);
            return Promise.reject(error);
        }
    }

}
export default MarketPlaceFilterService;