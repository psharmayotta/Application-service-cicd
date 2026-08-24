import { Transform } from "class-transformer";
import { IsNumber, IsNotEmpty, IsString } from "class-validator";

export class LogoutDto {
   @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': 'API Access token is required' })
    api_access_token!: string; 
}
