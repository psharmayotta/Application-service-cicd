import { IsString, IsOptional, MaxLength, Matches } from "class-validator";

export class PlaygroundDto {
    @IsString()
    @MaxLength(100)
    @Matches(/^[^<>]*$/, { message: 'Name must not contain HTML tags or special characters like < >' })
    name: string;
} 