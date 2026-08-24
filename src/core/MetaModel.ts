type fileStructure = {
    fileKey: string;
    allowedSize: number;
    allowedExtensions: string[];
    colName: string;
    require: string;
}


export class MetaModel {
    modelName: string;
    fileFieldName: string;
    files: fileStructure[];

    constructor(name: string, fieldName: string, files: fileStructure[]) {
        this.modelName = name;
        this.fileFieldName = fieldName;
        this.files = files;
    }
}