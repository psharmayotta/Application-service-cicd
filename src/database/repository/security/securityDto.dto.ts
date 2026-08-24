import { IsString } from "class-validator";

export class SecurityDto{
    @IsString()
    details: string;
}