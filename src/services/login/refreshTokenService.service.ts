import { decrypt } from "dotenv";
import { AwsService } from "../../core/AwsService";
import { RefreshTokenDto } from "../../database/repository/refreshToken/refreshToken.dto";
import { RefreshTokenModel } from "../../database/repository/refreshToken/refreshToken.model";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { createjwt, refreshjwt, verifyjwt, verifyjwtStrict } from "../../utils/jwt/jwt";
import { BaseServices } from "../baseService.services";

class RefreshTokenService extends BaseServices {
    constructor(entity: any = MemberLoginsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): RefreshTokenModel {
        return new RefreshTokenModel()
    }

    getDTO(): any {
        return RefreshTokenDto;
    }

    getModuleName(): string {
        return 'Refresh Token';
    }


    refreshToken(model: RefreshTokenModel): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const decryptToken: any = verifyjwtStrict(model.api_refresh_token);
                const memberLoginsEntity = await this.entity
                    .createQueryBuilder("u")
                    .select([
                        "u.*"
                    ])
                    .where("u.member_id = :member_id", { member_id: decryptToken.member_id })
                    .andWhere("u.refresh_token = :refresh_token", { refresh_token: model.api_refresh_token })
                    .andWhere("u.is_delete = 0")
                    .getRawOne();

                if (!memberLoginsEntity) {
                    return reject('E10023');
                }
                memberLoginsEntity.access_token = createjwt({ id: memberLoginsEntity.id, email: '', role_id: 1, member_id: memberLoginsEntity.member_id });
                await this.entity.update({ id: memberLoginsEntity.id }, { access_token: memberLoginsEntity.access_token });
                delete memberLoginsEntity.password;
                const record = memberLoginsEntity;
                delete record.provider;
                delete record.is_delete;
                delete record.created_at;
                delete record.modified_at;
                delete record.provider_user_id;
                resolve(record);
            } catch (error) {
                console.log('-------------error------------', error);
                reject(error);
            }
        });
    }

}

export default RefreshTokenService;

