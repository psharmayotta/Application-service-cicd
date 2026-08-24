/**
 * Filter properties from req.body by comparing an object
 * @param classModel any
 * @param body any
 */

const sanitizeBody = (classModel: any, body: any) => {
    Object.keys(body).forEach((key) => {
        if (!classModel.hasOwnProperty(key)) {
            delete body[key];
        }
    });

    return body;
};

export default sanitizeBody;  