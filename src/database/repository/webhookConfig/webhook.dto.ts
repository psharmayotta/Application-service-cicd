import { IsNumber, IsString, IsOptional, IsNotEmpty, IsArray, IsObject, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WebhookIntegratedPlatformDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @IsNumber()
  platform_id: number;

  @IsNotEmpty()
  @IsObject()
  config: any;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  events: string[];
}

export class WebhookDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @IsNumber()
  company_id: number;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookIntegratedPlatformDto)
  platforms: WebhookIntegratedPlatformDto[];
}
