import { Transform } from "class-transformer";
import { IsNumber, IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ 'message': 'API Refresh token is required' })
    api_refresh_token!: string;
}
