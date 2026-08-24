import { S3, SecretsManager } from 'aws-sdk';
import { AWS_ACCESS_KEY, AWS_BUCKET_NAME, AWS_ENDPOINT, AWS_LOCATION, AWS_S3_FOLDER_NAME, AWS_SECRET_KEY, AWS_SECRET_REGION, AWS_SIGNED_URL_EXPIRY, CDN_LINK } from '../config';
import { FileObject, UploadedFile } from './FileModel';

export class AwsService {

    private client: S3;

    private readonly bucketName =AWS_BUCKET_NAME;
    constructor() {
        this.client = new S3({
            region: AWS_LOCATION,
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_KEY,
            endpoint: AWS_ENDPOINT,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
        });
    }

    public getS3ObjectStream(key: string) {
        const params = {
            Bucket: this.bucketName,
            Key: key,
        };
        return this.client.getObject(params).createReadStream();
    }

    private async uploadFile(file: FileObject, modelName: string, id: string): Promise<any> {
        try {
            const fileKey = this.generateFileKey(file, modelName, id);
            const params = { Bucket: this.bucketName, Key: fileKey, ContentType: file.mimetype, Body: file.buffer };
            const responce: any = await this.client.upload(params).promise();
            const data = {}
            data[file['fieldname']] = file.originalname;
            return data
        } catch (e) {
            return e
        }
    }

    public async upload(files: FileObject | FileObject[], modelName: string, id: string): Promise<UploadedFile | UploadedFile[] | undefined> {
        try {
            if (Array.isArray(files)) {
                const paths = await Promise.all(files.map(async (file) => this.uploadFile(file, modelName, id)));
                return paths;
            }
            const path = await this.uploadFile(files, modelName, id);
            return path
        } catch {
            return undefined;
        }
    }

    private generateFileKey(file: FileObject, modelName: string, id: string): string {
        file.originalname = file.originalname.replace(/ /g, '-');
        const fileKey = `${AWS_S3_FOLDER_NAME}/${modelName}/${id}/${file.originalname}`
        return fileKey;
    }

    private buildCdnUrl(key: string): string {
        const normalizedBaseUrl = CDN_LINK.replace(/\/+$/, '');
        const normalizedKey = key.replace(/^\/+/, '');
        return `${normalizedBaseUrl}/${normalizedKey}`;
    }

    public async generateSignedUrl(key: string): Promise<string> {
        try {
            if (CDN_LINK) {
                return this.buildCdnUrl(key);
            }
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Expires: AWS_SIGNED_URL_EXPIRY,
            };
            const signedUrl = await this.client.getSignedUrlPromise('getObject', params);
            return signedUrl;
        } catch (e) {
            throw e; // Handle errors appropriately
        }
    }
    public async deleteFiles(filePaths: string[]) {
        for (const filePath of filePaths) {
            const params = {
                Bucket: this.bucketName,
                Key: filePath,
            };
            try {
                await this.client.deleteObject(params).promise();
            } catch (error) {
                return error
            }
        }
        return true
    };

    // this function return the Media from S3 bucket
    // public async getMedia(filePaths: string[]) {
    //     try {

    //         let mediaData = [];
    //         for (const filePath of filePaths) {
    //             if (filePath != undefined) {
    //                 const params = {
    //                     Bucket: this.bucketName,
    //                     Key: filePath,
    //                 };
    //                 console.log(params,"printing the param")
    //                 const media = await this.client.getObject(params).promise();
    //                 if(media){
    //                     mediaData.push(media);
    //                 }
    //             }
    //         }
    //         return mediaData;
    //     } catch (error) {
    //         return error;
    //     }
    // }

    public async getMedia(filePaths: string[]) {
        let mediaData = [];
        for (const filePath of filePaths) {
            try {
                const params = {
                    Bucket: this.bucketName,
                    Key: filePath,
                };
                console.log(params, "printing the param");
                const media = await this.client.getObject(params).promise();
                if (media) {
                    mediaData.push(media);
                }
            } catch (error) {
                console.error(`Failed to get ${filePath}: ${error}`);
                // Optionally: skip or log, but DON'T break the whole loop
            }
        }
        return mediaData;
    }
    

    private generateErrorFileKey(file: FileObject, modelName: string, module_name: string): string {
        file.originalname = file.originalname.replace(/ /g, '-');
        const fileKey = `${AWS_S3_FOLDER_NAME}/${modelName}/${module_name}/${file.originalname}`
        return fileKey;
    }

    public async uploadErrorFile(file: FileObject, modelName: string, module_name: string): Promise<any> {
        try {
            const fileKey = this.generateErrorFileKey(file, modelName, module_name);
            const params = { Bucket: this.bucketName, Key: fileKey, ContentType: file.mimetype, Body: file.buffer };
            const responce: any = await this.client.upload(params).promise();
            const data = {}
            data['originalname'] = fileKey;
            return data
        } catch (e) {
            return e
        }
    }
}

// fetch the creds from aws secret
export async function getSecretKey(secretName: string): Promise<string | undefined> {
    const secretsManager = new SecretsManager({
        region: AWS_SECRET_REGION
    });

    try {
        const secretValue = await secretsManager
            .getSecretValue({ SecretId: secretName })
            .promise();

        // Return the secret string if available
        if (secretValue.SecretString) {
            const secretData = JSON.parse(secretValue.SecretString);
            return secretData;
        }

        // If the secret is in binary form
        if (secretValue.SecretBinary) {
            const buffer = Buffer.from(secretValue.SecretBinary as string, 'base64');
            const secretData = buffer.toString('ascii');
            return secretData;
        }
    } catch (error) {
        console.error(`Error fetching secret: ${error}`);
    }

    return undefined;
};

