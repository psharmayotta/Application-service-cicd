import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { InfraQueueModuleType, InfraQueueStatus } from '../../../config';

export class InfraQueueDto {
    @IsEnum(InfraQueueModuleType, { message: 'Invalid module type' })
    @IsNotEmpty({ message: 'Module type is required' })
    module_type: InfraQueueModuleType;

    @IsInt({ message: 'Module ID must be an integer' })
    @IsNotEmpty({ message: 'Module ID is required' })
    module_id: number;

    @IsInt({ message: 'Accelerator ID must be an integer' })
    @IsNotEmpty({ message: 'Accelerator ID is required' })
    accelerator_id: number;

    @IsInt({ message: 'Accelerator count must be an integer' })
    @IsOptional()
    accelerator_count?: number;

    @IsInt({ message: 'Priority must be an integer' })
    @IsOptional()
    priority?: number;

    @IsEnum(InfraQueueStatus, { message: 'Invalid queue status' })
    @IsOptional()
    status?: InfraQueueStatus;

    @IsNotEmpty({ message: 'Payload is required' })
    payload: any;

    @IsString({ message: 'Error message must be a string' })
    @IsOptional()
    error_message?: string;

    @IsInt({ message: 'Company ID must be an integer' })
    @IsNotEmpty({ message: 'Company ID is required' })
    company_id: number;

    @IsInt({ message: 'Member ID must be an integer' })
    @IsNotEmpty({ message: 'Member ID is required' })
    member_id: number;
}
