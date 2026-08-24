import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    ValidateIf,
} from 'class-validator';

export class DeploymentKbIntegrationDto {
    @ValidateIf((object) => object.id !== undefined)
    @IsInt({ message: 'id must be an integer' })
    @IsNotEmpty({ message: 'id is required' })
    id!: number;

    @IsInt({ message: 'deployment_id must be an integer' })
    @IsNotEmpty({ message: 'deployment_id is required' })
    deployment_id: number;

    @IsInt({ message: 'knowledge_base_id must be an integer' })
    @IsNotEmpty({ message: 'knowledge_base_id is required' })
    knowledge_base_id: number;

    @IsOptional()
    @IsBoolean({ message: 'is_active must be a boolean' })
    is_active?: boolean;
}

export class DeintegrateDto {
    @IsInt({ message: 'id must be an integer' })
    @IsNotEmpty({ message: 'id is required' })
    id!: number;
}
