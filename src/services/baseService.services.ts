import { Pagination, InferParams } from '../core/InferParams';
import { AwsService } from '../core/AwsService';
import { FileObject } from '../core/FileModel';
import { MetaModel } from '../core/MetaModel';
import { In } from 'typeorm';
import { InferModel } from '../database/repository/InferModel/InferModel.model';
import { AWS_S3_FOLDER_NAME } from '../config';
import { InferencingEntity } from '../entities/inferenceEntity';


export abstract class BaseServices {
    public entity;

    protected constructor(entity: InferencingEntity, protected awsService: AwsService) {
        this.entity = entity;
    }

    abstract getModel(): InferModel;
    abstract getDTO(): any;

    getModuleName(): string {
        return '';
    }

    getMetaModel(): MetaModel {
        return null;
    }

    prepareFilter(param: Pagination): any {
        const filter = { where: { is_delete: 0 }, order: { created_at: 'DESC' } }
        return filter;
    }

    postProcessAfterGetData(result: InferModel, param: Pagination): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public getAll = async (param: Pagination): Promise<any> => {
        try {
            const findFilter: any = await this.prepareFilter(param);
            const record = await this.entity.find(findFilter);
            return this.postProcessAfterGetData(record, param);
        } catch (e) {
            console.log('fetch error', e);
            throw e;
        }
    };

    postProcessAfterGetById(result: any): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public getById = async (param: InferParams): Promise<InferModel> => {
        try {
            const record = await this.findEntity(param.id);
            return this.postProcessAfterGetById(record);
        } catch (e) {
            throw e;
        }
    };

    createPreProcess(model: InferModel, files: FileObject[] | null): Promise<InferModel> {
        return new Promise<InferModel>((resolve, reject) => {
            resolve(this.transformModel(model));
        });
    }

    transformModel(model: InferModel): InferModel {
        return model;
    }

    protected async findEntity(id: number): Promise<InferencingEntity> {
        try {
            let entity = null;
            if (id) {
                entity = await this.entity.findOneBy({ id: id, is_delete: 0 });
                if (entity == null) {
                    return Promise.reject(`E10021`)
                }
            }
            return Promise.resolve(entity);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    protected async saveData(model: InferModel, existEntity: InferencingEntity): Promise<InferModel> {
        try {
            model.id !== undefined ? model.id = +model.id : model
            const recordItem = await this.entity.save({ ...model });
            return Promise.resolve(recordItem);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    protected async filterFileData(files: FileObject[] | null, fileFieldName: string): Promise<any> {
        let filterFile = null

        if (files) {
            filterFile = files.filter(file => file.fieldname === fileFieldName);
        }
        return Promise.resolve(filterFile)
    }


    protected async uploadFiles(files: FileObject[] | null, modelName: string | null, fileFieldName: string, id): Promise<any> {
        try {
            if (files) {
                const fileObj = await this.filterFileData(files, fileFieldName)
                if (fileObj.length > 0 && fileObj !== null) {
                    return await this.awsService.upload(fileObj, modelName, id);
                }
            }
            return null;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    protected async transformFileData(model: InferModel, files: FileObject[] | null): Promise<any> {
        try {
            const fileData = {
                ...model,
                files
            }
            return Promise.resolve(fileData)
        } catch (error) {
            return Promise.reject(error);
        }
    }

    protected async updateFileData(awsRes: any, recordItem: InferModel): Promise<InferModel> {
        try {
            if (awsRes !== null) {
                recordItem = await this.transformFileData(recordItem, awsRes)
                const record = this.entity.create({ ...recordItem });
                recordItem = await record.save();
                return Promise.resolve(recordItem);
            } else {
                return Promise.resolve(recordItem);
            }
        } catch (error) {
            console.log('---------------error------------', error);
            return Promise.reject(error);
        }
    }

    createPostProcess(result: InferModel, model: InferModel, files: any): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public createRecord(model: InferModel, files: FileObject[] | null): Promise<InferModel> {
        return new Promise((resolve, reject) => {

            let recordItem = null;
            Promise.resolve()
                .then(() => {
                    return this.createPreProcess(model, files);
                })
                .then(async (res) => {
                    model = res;
                    return this.findEntity(res.id);
                })
                .then(async (existEntity) => {
                    return this.saveData(model, existEntity);
                })
                .then(async (rec) => {
                    recordItem = rec;
                    const res = await this.uploadFiles(files, this.getMetaModel()?.modelName, this.getMetaModel()?.fileFieldName, recordItem.id);
                    return Promise.resolve(res);
                })
                .then(async (awsres: any) => {
                    return this.updateFileData(awsres, recordItem);
                })
                .then((final) => {
                    return this.createPostProcess(final, model, files);
                })
                .then((result) => {
                    resolve(result);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    MultiPreProcess(model: InferModel | InferModel[], files: FileObject[] | null): Promise<InferModel | InferModel[]> {
        return new Promise((resolve, reject) => {
            resolve(model);
        });
    }

    MultiPostProcess(result: InferModel, model: any, files: FileObject[] | null): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public async createMultiRecords(models: InferModel | InferModel[], files: FileObject[] | null): Promise<any> {
        try {
            const modelsArray: any = await this.MultiPreProcess(models, files);
            let result = [];
            for (const model of modelsArray) {
                const record = await this.createPreProcess(model, files);
                const getEntity = await this.findEntity(record.id);
                const recordItem = await this.saveData(record, getEntity);
                const res = await this.uploadFiles(files, this.getMetaModel()?.modelName, this.getMetaModel()?.fileFieldName, recordItem.id);
                const awsres = await this.updateFileData(res, recordItem);
                const final = await this.MultiPostProcess(awsres, model, files)
                result.push(final);
            }
            return Promise.resolve(result);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    deletePreProcess(model: InferModel): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(model);
        })
    }

    deletePostProcess(result: InferModel): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        })
    }

    protected getFilePathData(model: InferModel): Promise<any> {
        try {
            let keys = [];
            let deletePaths = [];
            const metaModel = this.getMetaModel();
            keys = metaModel.files.length !== 0 && metaModel !== null ? metaModel.files.map((file) => file.fileKey) : [];
            if (keys.length > 0) {
                for (const key of keys) {
                    if (model[key] !== undefined) {
                        deletePaths.push(model[key]);
                    }
                }
                return Promise.resolve(deletePaths);
            }
            return Promise.resolve(deletePaths);
        } catch (error) {
            return Promise.reject(error)
        }
    }

    getDeleteEntity(): InferencingEntity {
        return this.entity;
    }

    protected async deleteFileData(record, param, deletePaths): Promise<boolean> {
        try {
            if (!record) {
                return false;
            }
            deletePaths.length !== 0
                ? await this.awsService.deleteFiles(deletePaths).then(async (res) => {
                    await this.getDeleteEntity().remove(param.id)
                    return true;
                })
                : await this.getDeleteEntity().remove(param.id);
            return true;
        } catch (error) {
            return Promise.reject(error)
        }
    }

    public deleteData = async (param: any): Promise<any> => {
        try {
            const record = await this.findEntity(param.id);
            const preDeleteData = await this.deletePreProcess(record);
            const getDeletePath = await this.getFilePathData(preDeleteData);
            const isDeleteFlag = await this.deleteFileData(preDeleteData, param, getDeletePath)
            const postDeleteData = await this.deletePostProcess(preDeleteData)
            return postDeleteData;
        } catch (e) {
            throw e;
        }
    };

    updateDeleteFlagPreProcess(param: InferParams): Promise<any> {
        try {
            let whereid = null;
            if (param.id) {
                whereid = In(Array.isArray(param.id) ? param.id : [param.id]); // Ensure it's always an array
            }
            return Promise.resolve(whereid);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    updateDeleteFlagPostProcess(records: any, param: InferParams): Promise<void> {
        return Promise.resolve();
    }

    public updateDeleteFlagData = async (param: InferParams): Promise<boolean> => {
        try {
            const whereid = await this.updateDeleteFlagPreProcess(param)
            if (whereid === null) {
                return false;
            } else {
                const record = await this.entity.find({ where: { id: whereid, is_delete: 0 } });
                if (record != '' && record != null) {
                    await this.entity.createQueryBuilder().update(this.entity).set({ is_delete: 1 }).where({ id: whereid }).execute();
                    await this.updateDeleteFlagPostProcess(record, param);
                    return true;
                } else {
                    return false;
                }
            }
        } catch (e) {
            throw e;
        }
    };

    // For generating the signedURL
    public generateSignedUrl = async (folder: string, id: number, filename: string) => {
        try {
            if (filename != null) {
                const keyurl = `${AWS_S3_FOLDER_NAME}/${folder}/${id}/${filename}`;
                return await this.awsService.generateSignedUrl(keyurl);
            }
            return null;
        } catch (error) {
            return Promise.reject(error);
        }
    };


    async prepareQuery(param: Pagination): Promise<any> {
        return Promise.resolve(param);
    }

    postProcessAfterGetAll(result: InferModel): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public getData = async (param: Pagination): Promise<any> => {
        try {
            const record = await this.prepareQuery(param);
            return this.postProcessAfterGetAll(record);
        } catch (e) {
            console.log('fetch error', e);
            throw e;
        }
    };

    async prepareQueryById(param: Pagination): Promise<any> {
        return Promise.resolve(param);
    }

    postProcessGetById(result: InferModel): Promise<InferModel> {
        return new Promise((resolve, reject) => {
            resolve(result);
        });
    }

    public getDataById = async (param: Pagination): Promise<any> => {
        try {
            const record = await this.prepareQueryById(param);
            return this.postProcessGetById(record);
        } catch (e) {
            console.log('fetch error', e);
            throw e;
        }
    };
}
