import { IsString, IsEmail, IsArray, ArrayNotEmpty } from 'class-validator';

export class HuggingFaceRepoVerificationDto {
    @IsString()
    repository_url: string;
}
