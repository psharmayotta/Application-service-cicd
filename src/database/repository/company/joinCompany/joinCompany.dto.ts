
import { IsString, IsNotEmpty } from 'class-validator';

export class JoinCompanyDto {
    @IsNotEmpty()
    @IsString()
    company_unique_id: string;
}
