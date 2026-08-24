export const editValidator = (object: any, value: any, key: any): boolean => {
    if (object.id !== undefined && object[key] === undefined) {
        return false;
    }
    else if (object.files != null && object.id != null) {
        object.files = object.files.filter(file => file.file !== null && file.file !== undefined);
        return false;
    }
    else if (object.files == null && object.id != null) {
        return false;
    }
    else if (object.id != null) {
        return true;
    }
    else {
        return true;
    }
};