import { Column, Entity } from "typeorm";
import { InferencingEntity } from "./inferenceEntity";

@Entity({ schema: "public", name: "docs_cms_page_relation" })
export class DocsCmsPageRelationEntity extends InferencingEntity {

    @Column({ type: "varchar", length: 100, unique: true })
    page_name: string;

    @Column({
        type: "int",
        array: true,
        nullable: true,
        default: () => "'{}'",
    })
    doc_ids: number[];
}
