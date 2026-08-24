import { IsString, IsNotEmpty } from "class-validator";

export class SsoLoginDto {
    @IsString({ message: "Keycloak token must be a string" })
    @IsNotEmpty({ message: "Keycloak token is required and cannot be empty" })
    keycloak_token: string;
}
