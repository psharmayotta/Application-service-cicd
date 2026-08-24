import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";
import { integer } from "aws-sdk/clients/cloudfront";
import { DatasetFormat, DatasetType } from "../config";


@Entity({ schema: "model", name: "data_sets" })
export class DataSetEntity extends InferencingEntity {

    @Column({ type: "integer", nullable: false })
    company_id: number; // replaces company_id

    @Column({ type: "integer", nullable: false })
    member_id: number;

    @Column({ type: "varchar", length: 255, nullable: false })
    name: string; // Dataset name

    @Column({ type: "text", nullable: false })
    description: string;

    @Column({ type: "integer", nullable: false })
    cloud_service_id: number;

    @Column({ type: "text", nullable: true })
    dataset_path: string;

    @Column({ type: "integer", nullable: true })
    cloud_secret_id: number;

    @Column({ type: "integer", nullable: true })
    region_id: number;

    @Column({ type: "varchar", nullable: false })
    type: string; // relates to dataset type

    @Column({ type: "text", nullable: true })
    uri: string; // Dataset storage location

    @Column({ type: "varchar", nullable: false })
    data_format: string; // Validation for uploaded files

    @Column({ type: "json", nullable: true })
    meta_data: any;

    @Column({ type: "boolean", default: false })
    download_status: boolean;

    @Column({ type: "varchar", nullable: true })
    yotta_bucket_path: string;

    @Column({ type: "varchar", length: 50, nullable: true })
    size: string;

    @Column({ type: "text", nullable: true })
    failure_message: string;

    @Column({ type: "varchar", nullable: true })
    status: string;

    @Column({ type: "varchar", nullable: true })
    module_name: string;

    @Column({ type: "integer", nullable: true })
    category_id: number;
}

