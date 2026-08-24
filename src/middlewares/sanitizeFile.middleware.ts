import { MetaModel } from "../core/MetaModel";

/**
 * Filter properties from req.body by comparing an object
 * @param classModel any
 * @param files any
 */
const sanitizeFile = (metaModel: MetaModel, files: any) => {
    const sanitizeFile = []
    const keys = metaModel.files.map(file => file.fileKey);
    for (let i = 0; i < files.length; i++) {
        let currFile = files[i];
        if (keys.includes(currFile.fieldname)) {
            sanitizeFile.push(currFile)
        }
    }
    return sanitizeFile;
}



export default sanitizeFile;