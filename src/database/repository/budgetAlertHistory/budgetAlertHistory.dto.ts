import { IsNumber, IsString, IsOptional, IsNotEmpty, IsDate, IsBoolean } from 'class-validator';

export class BudgetAlertHistoryDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNotEmpty()
  @IsNumber()
  budget_control_id: number;

  @IsNotEmpty()
  @IsNumber()
  company_id: number;

  @IsNotEmpty()
  @IsNumber()
  threshold_level: number;

  @IsNotEmpty()
  @IsString()
  alert_period: string;

  @IsOptional()
  @IsDate()
  alert_date?: Date;

  @IsOptional()
  @IsBoolean()
  is_seen?: boolean;
}
