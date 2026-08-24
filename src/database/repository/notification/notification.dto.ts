import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class NotificationDto {
    @IsNumber()
    @IsNotEmpty()
    user_id: number;

    @IsString()
    @IsNotEmpty()
    notification_type: string;

    @IsString()
    @IsNotEmpty()
    module_name: string;

    @IsBoolean()
    @IsOptional()
    is_readed: boolean;

    @IsNumber()
    @IsNotEmpty()
    company_id: number;

    @IsString()
    @IsOptional()
    message: string;
}
