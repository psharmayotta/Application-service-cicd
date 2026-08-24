import { IsString, IsOptional } from 'class-validator';

export class GoogleCallbackDto {
    @IsString()
    code: string;

    @IsOptional()
    @IsString()
    state?: string;
}
