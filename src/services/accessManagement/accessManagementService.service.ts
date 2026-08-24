import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { AccessManagementDto } from "../../database/repository/accessManagement/accessManagement.dto";
import { Pagination } from "../../core/InferParams";
import Database from '../../database/database';
class AccessManagementService extends BaseServices {
    constructor(entity: any = CompanyMemberRolesEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): AccessManagementDto {
        return new AccessManagementDto();
    }

    getDTO() {
        return AccessManagementDto;
    }

    override prepareQueryById(param: Pagination): Promise<any> {
        return Promise.resolve(param);
    }

    override prepareQuery = async (param: any): Promise<any> => {
        try {
            const db = Database.getInstance();
            const companyId = param.company_id;

            if (!companyId) {
                return Promise.reject("Company ID is required");
            }

            // WITH invite_emails AS (

            //     /* -------- JSON ARRAY EMAILS -------- */
            //     SELECT
            //     i.id,
            //     i.created_at,
            //     i.role_id,
            //     i.company_unique_code,
            //     i.is_delete,
            //     i.created_by,
            //     i.status,
            //     jsonb_array_elements_text(i.email::jsonb) AS email
            //     FROM v0_dev_yotta.invites i
            //     WHERE i.email LIKE '[%]'

            //     UNION ALL

            //     /* -------- STRING EMAILS -------- */
            //     SELECT
            //     i.id,
            //     i.created_at,
            //     i.role_id,
            //     i.company_unique_code,
            //     i.is_delete,
            //     i.created_by,
            //     i.status,
            //     i.email AS email
            //     FROM v0_dev_yotta.invites i
            //     WHERE i.email NOT LIKE '[%]'
            // )

            // SELECT DISTINCT ON (ie.email)
            //     m.id,
            //     m.full_name,
            //     ie.email,
            //     m.profile_picture,
            //     m.last_login,
            //     m.is_active,
            //     m.user_id,
            //     r.name AS role_name,
            //     ie.id as invite_id,
            //     ie.created_at AS invited_at_time,
            //     ie.status AS status,

            //     /* ✅ creator name */
            //     creator.full_name AS created_by_name,
            //     creator.profile_picture AS created_by_profile_picture

            // FROM invite_emails ie

            // JOIN v0_dev_yotta.members m
            //     ON LOWER(m.email) = LOWER(ie.email)
            //     AND m.is_delete = 0

            // LEFT JOIN v0_dev_yotta.members creator
            //     ON ie.created_by = creator.id
            //     AND creator.is_delete = 0

            // LEFT JOIN v0_dev_yotta.roles r
            //     ON ie.role_id = r.id

            // WHERE ie.company_unique_code = (
            //     SELECT company_unique_id
            //     FROM v0_dev_yotta.company
            //     WHERE id = $1
            // )
            // AND ie.is_delete = 0

            // -- 🔥 latest invite per email
            // ORDER BY ie.email, ie.created_at DESC
            // `;
            const query = `
                SELECT * FROM (
                SELECT DISTINCT ON (LOWER(email))
                    id,
                    full_name,
                    email,
                    profile_picture,
                    last_login,
                    is_active,
                    user_id,
                    role_name,
                    invite_id,
                    invited_at_time,
                    status,
                    created_by_name,
                    created_by_profile_picture,
                    created_by_id
                FROM (
                    SELECT
                        0 AS prio,
                        m.id,
                        m.full_name,
                        m.email,
                        m.profile_picture,
                        m.created_at AS last_login,
                        m.is_active,
                        m.user_id,
                        'admin' AS role_name,
                        NULL::int AS invite_id,
                        m.created_at AS invited_at_time,
                        'active' AS status,
                        m.full_name AS created_by_name,
                        m.profile_picture AS created_by_profile_picture,
                        m.id AS created_by_id
                    FROM v0_dev_yotta.company c
                    JOIN v0_dev_yotta.members m
                        ON m.id = c.created_by AND m.is_delete = 0
                    WHERE c.id = ${companyId}

                    UNION ALL

                    SELECT
                        1 AS prio,
                        m.id,
                        m.full_name,
                        m.email,
                        m.profile_picture,
                        m.created_at AS last_login,
                        m.is_active,
                        m.user_id,
                        CASE
                            WHEN c.created_by = m.id THEN 'admin'
                            ELSE LOWER(COALESCE(rr.role_name, r.name, 'developer'))
                        END AS role_name,
                        inv.id AS invite_id,
                        COALESCE(cmr.created_at, m.created_at) AS invited_at_time,
                        'active' AS status,
                        company_admin.full_name AS created_by_name,
                        company_admin.profile_picture AS created_by_profile_picture,
                        company_admin.id AS created_by_id
                    FROM v0_dev_yotta.company c
                    JOIN v0_dev_yotta.company_member_roles cmr
                        ON cmr.company_id = c.id AND cmr.active = true AND cmr.is_delete = 0
                    JOIN v0_dev_yotta.members m
                        ON m.id = cmr.member_id AND m.is_delete = 0
                    LEFT JOIN v0_dev_admin_yotta.rbac_roles rr
                        ON rr.id = cmr.role_id AND rr.is_delete = 0
                    LEFT JOIN v0_dev_yotta.roles r
                        ON r.id = cmr.role_id
                    LEFT JOIN v0_dev_yotta.invites inv
                        ON inv.company_unique_code = c.company_unique_id
                       AND LOWER(inv.email) = LOWER(m.email)
                       AND inv.is_delete = 0
                    LEFT JOIN v0_dev_yotta.members company_admin
                        ON company_admin.id = c.created_by AND company_admin.is_delete = 0
                    WHERE c.id = ${companyId}

                    UNION ALL

                    SELECT
                        2 AS prio,
                        m.id,
                        m.full_name,
                        i.email,
                        m.profile_picture,
                        m.created_at AS last_login,
                        m.is_active,
                        m.user_id,
                        LOWER(COALESCE(rr.role_name, r.name, 'developer')) AS role_name,
                        i.id AS invite_id,
                        i.created_at AS invited_at_time,
                        i.status AS status,
                        company_admin.full_name AS created_by_name,
                        company_admin.profile_picture AS created_by_profile_picture,
                        company_admin.id AS created_by_id
                    FROM v0_dev_yotta.company c
                    JOIN v0_dev_yotta.invites i
                        ON i.company_unique_code = c.company_unique_id
                       AND i.is_delete = 0
                       AND LOWER(i.status) = 'pending'
                    LEFT JOIN v0_dev_yotta.members m
                        ON LOWER(m.email) = LOWER(i.email) AND m.is_delete = 0
                    LEFT JOIN v0_dev_admin_yotta.rbac_roles rr
                        ON rr.id = i.role_id AND rr.is_delete = 0
                    LEFT JOIN v0_dev_yotta.roles r
                        ON r.id = i.role_id
                    LEFT JOIN v0_dev_yotta.members company_admin
                        ON company_admin.id = c.created_by AND company_admin.is_delete = 0
                    WHERE c.id = ${companyId}

                    UNION ALL

                    SELECT
                        3 AS prio,
                        m.id,
                        m.full_name,
                        i.email,
                        m.profile_picture,
                        m.created_at AS last_login,
                        m.is_active,
                        m.user_id,
                        LOWER(COALESCE(rr.role_name, r.name, 'developer')) AS role_name,
                        i.id AS invite_id,
                        i.created_at AS invited_at_time,
                        i.status AS status,
                        company_admin.full_name AS created_by_name,
                        company_admin.profile_picture AS created_by_profile_picture,
                        company_admin.id AS created_by_id
                    FROM v0_dev_yotta.company c
                    JOIN v0_dev_yotta.invites i
                        ON i.company_unique_code = c.company_unique_id
                       AND i.is_delete = 0
                       AND LOWER(i.status) = 'cancelled'
                    LEFT JOIN v0_dev_yotta.members m
                        ON LOWER(m.email) = LOWER(i.email) AND m.is_delete = 0
                    LEFT JOIN v0_dev_admin_yotta.rbac_roles rr
                        ON rr.id = i.role_id AND rr.is_delete = 0
                    LEFT JOIN v0_dev_yotta.roles r
                        ON r.id = i.role_id
                    LEFT JOIN v0_dev_yotta.members company_admin
                        ON company_admin.id = c.created_by AND company_admin.is_delete = 0
                    WHERE c.id = ${companyId}
                ) all_rows
                ORDER BY LOWER(email), prio
                ) deduped
                ORDER BY
                    CASE
                        WHEN status = 'active' THEN 0
                        WHEN LOWER(status) = 'pending' THEN 1
                        ELSE 2
                    END,
                    CASE WHEN role_name = 'admin' THEN 0 ELSE 1 END,
                    invited_at_time DESC;
            `

            const result = await db.executeExternalQuery(query, []);

            for (const row of result) {
                const profilePic = row.profile_picture;
                if (!profilePic || profilePic.trim() === "") {
                    row.profile_picture = null;
                    row.profile_picture_url = null;
                } else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                    row.profile_picture = profilePic;
                    row.profile_picture_url = profilePic;
                } else {
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "members",
                            row.id,
                            profilePic
                        );
                        row.profile_picture = profilePic;
                        row.profile_picture_url = signedUrl;
                    } catch {
                        row.profile_picture_url = null;
                    }
                }

                const adminPic = row.created_by_profile_picture;
                if (!adminPic || adminPic.trim() === "") {
                    row.created_by_profile_picture = null;
                    row.created_by_profile_picture_url = null;
                } else if (adminPic.startsWith("http://") || adminPic.startsWith("https://")) {
                    row.created_by_profile_picture = adminPic;
                    row.created_by_profile_picture_url = adminPic;
                } else {
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "members",
                            row.created_by_id,
                            adminPic
                        );
                        row.created_by_profile_picture = adminPic;
                        row.created_by_profile_picture_url = signedUrl;
                    } catch {
                        row.created_by_profile_picture_url = null;
                    }
                }
            }
            return result;
        } catch (e) {
            throw e;
        }
    };
}

export default AccessManagementService;