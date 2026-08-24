import { LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { ReservationEntity } from "../entities/reservationEntity";
import { HardwareSpecsEntity } from "../entities/hardwareSpecsEntity";
import { HardwareMasterEntity } from "../entities/hardwareMasterEntity";

export interface ReservationCheckResult {
    is_reserved: boolean;
    reservation_id: number | null;
}

/**
 * Check if a company has an active approved reservation for a specific GPU type.
 * Matches when: company has an approved reservation for the same hardware_master (GPU type),
 * with sufficient accelerator count, and the current time falls within the reservation window.
 *
 * @param companyId - Company ID
 * @param hardwareMasterId - hardware_master ID (GPU type like H100, L40S)
 * @param acceleratorCount - Number of GPUs being requested
 */
export async function checkReservationForGpu(
    companyId: number,
    hardwareMasterId: number,
    acceleratorCount: number = 1
): Promise<ReservationCheckResult> {
    try {
        if (!companyId || !hardwareMasterId) {
            return { is_reserved: false, reservation_id: null };
        }

        const now = new Date();

        // Reservation's infra_node_id maps to hardware_master.id
        const reservation = await ReservationEntity.findOne({
            where: {
                company_id: companyId,
                infra_node_id: hardwareMasterId,
                status: 'approved',
                is_delete: 0,
                start_date: LessThanOrEqual(now),
                end_date: MoreThanOrEqual(now),
            },
            order: { id: 'DESC' }
        });

        if (reservation && reservation.accelerator_count >= acceleratorCount) {
            return { is_reserved: true, reservation_id: reservation.id };
        }

        return { is_reserved: false, reservation_id: null };
    } catch (error) {
        console.error('[ReservationCheck] Error checking reservation:', error);
        return { is_reserved: false, reservation_id: null };
    }
}

/**
 * Resolve hardware_master_id from hardware_specs_id.
 * Use this when you only have the hardware_specs ID (e.g., from ModelEntity.accelerator_id).
 */
export async function getHardwareMasterIdFromSpecs(hardwareSpecsId: number): Promise<number | null> {
    try {
        if (!hardwareSpecsId) return null;
        const specs = await HardwareSpecsEntity.findOneBy({ id: hardwareSpecsId, is_delete: 0 });
        return specs ? specs.hardware_master_id : null;
    } catch (error) {
        console.error('[ReservationCheck] Error resolving hardware_master_id:', error);
        return null;
    }
}

/**
 * Enrich a Kafka payload with reservation status.
 * Extracts company_id, accelerator info from the payload and checks for active reservations.
 * This is designed to be called from KafkaService.sendMessage to automatically attach
 * is_reserved and reservation_id to every outgoing message.
 *
 * @param message - The Kafka message payload object
 * @returns The enriched message with is_reserved and reservation_id fields
 */
export async function enrichWithReservationStatus(message: any): Promise<any> {
    try {
        if (!message || typeof message !== 'object') return message;

        // Already enriched — skip
        if (message.is_reserved !== undefined) return message;

        const companyId = message.company_id || message.org_id;
        if (!companyId) {
            return message;
        }

        // Determine accelerator count from various possible keys
        const acceleratorCount = message.accelerator_count
            || message.gpu_count_per_pod
            || message.gpu_count
            || (message.infrastructure && message.infrastructure.accelerator_count)
            || 1;

        // Try to resolve hardware_master_id from various payload fields
        let hardwareMasterId: number | null = null;

        // Helper: resolve hardware_master.id from a GPU model_name
        const resolveByModelName = async (modelName: string): Promise<number | null> => {
            if (!modelName) return null;
            const hwMaster = await HardwareMasterEntity.findOneBy({
                model_name: modelName,
                is_delete: 0
            });
            return hwMaster ? hwMaster.id : null;
        };

        // 1. Direct accelerator_id in payload (training uses this — maps to hardware_master.id)
        if (message.accelerator_id) {
            hardwareMasterId = message.accelerator_id;
        }

        // 2. Accelerator name at top level — resolve from hardware_master by model_name
        if (!hardwareMasterId && message.accelerator) {
            hardwareMasterId = await resolveByModelName(message.accelerator);
        }

        // 3. gpu_type field in payload or config
        if (!hardwareMasterId && message.gpu_type) {
            hardwareMasterId = await resolveByModelName(message.gpu_type);
        }

        // 4. Nested infrastructure.accelerator (My Model / compile-init payloads)
        if (!hardwareMasterId && message.infrastructure && message.infrastructure.accelerator) {
            hardwareMasterId = await resolveByModelName(message.infrastructure.accelerator);
        }

        // 5. node_group_names (Deployment payloads) — node groups are named by GPU type
        //    (there is no node_group -> hardware_master FK in the schema, so the node
        //    group name is the resolvable signal; e.g. node group "H100").
        if (!hardwareMasterId && Array.isArray(message.node_group_names) && message.node_group_names.length > 0) {
            for (const ngName of message.node_group_names) {
                hardwareMasterId = await resolveByModelName(ngName);
                if (hardwareMasterId) break;
            }
        }

        // If we couldn't determine the hardware, mark as not reserved
        if (!hardwareMasterId) {
            message.is_reserved = false;
            message.reservation_id = null;
            return message;
        }

        const reservationCheck = await checkReservationForGpu(
            companyId,
            hardwareMasterId,
            Number(acceleratorCount) || 1
        );

        message.is_reserved = reservationCheck.is_reserved;
        message.reservation_id = reservationCheck.reservation_id;

        return message;
    } catch (error) {
        console.error('[ReservationCheck] Error enriching message with reservation status:', error);
        message.is_reserved = false;
        message.reservation_id = null;
        return message;
    }
}
