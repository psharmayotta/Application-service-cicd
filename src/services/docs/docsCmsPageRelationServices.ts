import { Any } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { DocsCmsPageRelationEntity } from "../../entities/docsCmsPageRelationEntity";
import Database from "../../database/database";

class DocsCmsPageRelationServices extends BaseServices {
    constructor(entity: any = DocsCmsPageRelationEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): any {
        return Any;
    }

    getDTO(): any {
        return Any;
    }

    getModuleName(): string {
        return 'Docs Cms Page Relation';
    }

    override async prepareQuery(param: any): Promise<any> {
        try {
            const db = Database.getInstance();
            const selectSql = `
                SELECT
                dcprt.id,
                dcprt.page_name,
                dcprt.doc_ids,
                dcprt.created_at,
                dcprt.modified_at,
                dcprt.is_delete,

                COALESCE(
                    json_agg(
                        jsonb_build_object(
                            'id', d.id,
                            'name', d.name,
                            'short_desc', d.short_desc,
                            'image_path', d.image_path,
                            'link', d.link
                        )
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'
                ) AS docs

                FROM docs_cms_page_relation dcprt

                LEFT JOIN docs_tbl d
                    ON d.id = ANY(dcprt.doc_ids)
                    AND d.is_delete = 0
                WHERE dcprt.is_delete = 0
                GROUP BY dcprt.id
                ORDER BY dcprt.created_at DESC;

            `
            const queryResult = await db.executeExternalQuery(selectSql, []);
            let result = [];

            if (Array.isArray(queryResult) && queryResult.length > 0 && Array.isArray(queryResult[0])) {
                result = queryResult[0];
            } else {
                result = queryResult;
            }
            return { records: result };
        } catch (error) {
            console.error("prepareQuery error:", error);
            return Promise.reject(error);
        }
    }

    override async prepareQueryById(param: any): Promise<any> {
        try {
            if (!param?.id) {
                return Promise.reject("Page ID is required");
            }

            const db = Database.getInstance();

            const selectSql = `
                SELECT
                    dcprt.id,
                    dcprt.page_name,
                    dcprt.doc_ids,
                    dcprt.created_at,
                    dcprt.modified_at,
                    dcprt.is_delete,

                    COALESCE(
                    json_agg(
                        jsonb_build_object(
                        'id', d.id,
                        'name', d.name,
                        'short_desc', d.short_desc,
                        'image_path', d.image_path,
                        'link', d.link
                        )
                    ) FILTER (WHERE d.id IS NOT NULL),
                    '[]'
                    ) AS docs

                FROM docs_cms_page_relation dcprt
                LEFT JOIN docs_tbl d ON d.id = ANY(dcprt.doc_ids) AND d.is_delete = 0
                WHERE dcprt.id = $1 AND dcprt.is_delete = 0

                GROUP BY dcprt.id;
                `;

            const queryResult = await db.executeExternalQuery(selectSql, [param.id]);

            let result: any = null;

            if (
                Array.isArray(queryResult) &&
                queryResult.length > 0 &&
                Array.isArray(queryResult[0]) &&
                queryResult[0].length > 0
            ) {
                result = queryResult[0][0];
            } else if (Array.isArray(queryResult) && queryResult.length > 0) {
                result = queryResult[0];
            }

            if (!result) {
                return Promise.reject("Record not found");
            }

            return result;

        } catch (error) {
            console.log("ERROR prepareQueryById →", error);
            return Promise.reject(error);
        }
    }

}
export default DocsCmsPageRelationServices;