export interface FileObject {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: ArrayBuffer;
    size: number;
}

export interface UploadedFile {
    path: string;
}

export interface FileUpload {
    upload: (files: File[]) => Promise<UploadedFile[]>;
}
