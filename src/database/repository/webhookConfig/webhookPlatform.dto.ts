import { IsNumber, IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';

export class WebhookPlatformDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
