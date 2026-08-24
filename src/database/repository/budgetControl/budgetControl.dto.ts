import { IsNumber, IsString, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';

export class BudgetControlDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @IsNumber()
  company_id: number;

  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  type: string;

  @IsNotEmpty()
  @IsNumber()
  budget: number;

  @IsOptional()
  @IsNumber()
  threshold_alert_1?: number;

  @IsOptional()
  @IsNumber()
  threshold_alert_2?: number;

  @IsOptional()
  @IsNumber()
  threshold_alert_3?: number;

  @IsOptional()
  @IsBoolean()
  auto_stop_resources?: boolean;

  @IsOptional()
  @IsBoolean()
  is_custom_threshold?: boolean;
}
