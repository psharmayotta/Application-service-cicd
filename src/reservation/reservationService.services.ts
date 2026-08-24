import { AwsService } from "../core/AwsService";
import { FileObject } from "../core/FileModel";
import Database from "../database/database";
import { ReservationModel } from "../database/repository/reservation/reservation.model";
import { ReservationDto } from "../database/repository/reservation/reservationDto.dto";
import { ReservationEntity } from "../entities/reservationEntity";
import { HardwareMasterEntity } from "../entities/hardwareMasterEntity";
import moment from 'moment';
import AuditLogService from "../services/auditLog/auditLogService.services";
import { BaseServices } from "../services/baseService.services";
import { KafkaService } from "../utils/kafka/KafkaService";
import { GPU_RESERVATION_TOPIC, ReservationAction } from "../config";

class ReservationService extends BaseServices {
    constructor(entity: any = ReservationEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): ReservationModel {
        return new ReservationModel();
    }

    getDTO() {
        return ReservationDto;
    }

    getModuleName(): string {
        return 'Reservation';
    }

    override createPreProcess(model: ReservationModel, files: FileObject[] | null): Promise<ReservationModel> {
        return new Promise<ReservationModel>(async (resolve, reject) => {
            try {
                model.created_by = model.decryptToken.member_id;
                resolve(model);
            } catch (error) {
                reject(error);
            }
        });
    }

    override async createPostProcess(result: ReservationModel, model: ReservationModel, files: any): Promise<ReservationModel> {
        try {
            let gpuType = 'Unknown GPU';
            if (result.infra_node_id) {
                const hardware = await HardwareMasterEntity.findOneBy({ id: result.infra_node_id, is_delete: 0 });
                if (hardware) {
                    gpuType = hardware.model_name;
                }
            }

            const isUpdate = model.id !== undefined && model.id !== null && model.id !== 0;
            await AuditLogService.log({
                company_id: result.company_id,
                member_id: model.decryptToken?.member_id || result.created_by,
                module: this.getModuleName(),
                action: isUpdate ? 'UPDATE' : 'CREATE',
                entity_type: 'ReservationEntity',
                entity_id: result.id,
                entity_name: `Reservation-${result.id}`,
                description: `${isUpdate ? 'Updated' : 'Created a New'} Reservation of GPU Type ${gpuType} with Accelerator Count ${result.accelerator_count} from ${moment(result.start_date).format('DD-MM-YYYY')} to ${moment(result.end_date).format('DD-MM-YYYY')}`,
                ip_address: '',
            });
            return result;
        } catch (error) {
            console.error('-------ReservationService createPostProcess error---------', error);
            throw error;
        }
    }

    override updateDeleteFlagPostProcess = async (records: any, param: any): Promise<void> => {
        try {
            for (const record of records) {
                let gpuType = 'Unknown GPU';
                if (record.infra_node_id) {
                    const hardware = await HardwareMasterEntity.findOneBy({ id: record.infra_node_id, is_delete: 0 });
                    if (hardware) {
                        gpuType = hardware.model_name;
                    }
                }

                // Temporary hardcoded fallback
                if (record.infra_node_id === 4) {
                    gpuType = 'L40S';
                } else if (record.infra_node_id === 1) {
                    gpuType = 'H100';
                }

                const kafkaService = KafkaService.getInstance();
                await kafkaService.sendMessage(GPU_RESERVATION_TOPIC, {
                    action: ReservationAction.delete,
                    reservation_id: record.id,
                    company_id: record.company_id,
                    gpu_type: gpuType,
                    gpu_count: record.accelerator_count,
                    start_date: record.start_date,
                    end_date: record.end_date,
                    approved_by: record.approved_by || null,
                    timestamp: new Date().toISOString()
                });

                await AuditLogService.log({
                    company_id: record.company_id,
                    member_id: param.decryptToken?.member_id || record.created_by,
                    module: this.getModuleName(),
                    action: 'DELETE',
                    entity_type: 'ReservationEntity',
                    entity_id: record.id,
                    entity_name: `Reservation-${record.id}`,
                    description: `Deleted a Reservation of GPU Type ${gpuType} with Accelerator Count ${record.accelerator_count} from ${moment(record.start_date).format('DD-MM-YYYY')} to ${moment(record.end_date).format('DD-MM-YYYY')}`,
                    ip_address: param.ip_address || '',
                });
            }
        } catch (error) {
            console.error('Error in ReservationService updateDeleteFlagPostProcess:', error);
            throw error;
        }
    };

    async prepareQuery(param: any): Promise<any> {
        try {
            const db = Database.getInstance();

            const query = `
                SELECT r.*,
                    m.full_name AS creator_name,
                    m.profile_picture AS creator_profile_pic,
                    c.company_name AS company_name,
                    hm.model_name AS accelerator_type
                FROM infra_schema.reservation r
                LEFT JOIN v0_dev_yotta.members m ON m.id = r.created_by AND m.is_delete =0
                LEFT JOIN v0_dev_yotta.company c ON c.id = r.company_id AND c.is_delete =0
                LEFT JOIN infra_schema.hardware_master hm ON hm.id = r.infra_node_id AND hm.is_delete =0
                WHERE r.is_delete = 0 AND r.company_id = ${param.company_id}
                ORDER BY r.id DESC;
            `;
            const result = await db.executeExternalQuery(query);

            for (const row of result) {
                const profilePic = row.creator_profile_pic;
                if (!profilePic || profilePic.trim() === "") {
                    row.creator_profile_pic_url = null;
                } else if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
                    row.creator_profile_pic_url = profilePic;
                } else {
                    try {
                        const signedUrl = await this.generateSignedUrl(
                            "members",
                            row.created_by,
                            profilePic
                        );
                        row.creator_profile_pic_url = signedUrl;
                    } catch {
                        row.creator_profile_pic_url = null;
                    }
                }

            }
            return result;

        } catch (error) {
            console.error('Error fetching Reservation:', error);
            throw error;
        }
    }

}

export default ReservationService;