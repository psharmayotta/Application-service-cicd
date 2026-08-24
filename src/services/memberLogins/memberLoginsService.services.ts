import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { MemberLoginsEntity } from "../../entities/memberLoginsEntity";
import { MemberLoginsModel } from "../../database/repository/memberLogins/memberLogins.model";
import { MemberLoginsDto } from "../../database/repository/memberLogins/memberLogins.dto";

class MemberLoginsService extends BaseServices {
    constructor(entity: any = MemberLoginsEntity, protected awsService: AwsService = new AwsService()) {
        super(entity, awsService);
    }

    getModel(): MemberLoginsModel {
        return new MemberLoginsModel();
    }

    getDTO() {
        return MemberLoginsDto;
    }

    async findWithMemberByAccessToken(token: string): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { access_token: token }, relations: ["member"] });
    }

    async findByMemberAndProvider(memberId: number, provider: string): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { member_id: memberId, provider } });
    }

    async findByMemberId(memberId: number): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { member_id: memberId } });
    }

    async updateById(id: number, data: Partial<MemberLoginsEntity>): Promise<MemberLoginsEntity> {
        await this.entity.update(id, data);
        return await this.entity.findOneBy({ id }) as MemberLoginsEntity;
    }

    async createLogin(data: Partial<MemberLoginsEntity>): Promise<MemberLoginsEntity> {
        const record = this.entity.create(data);
        return await this.entity.save(record);
    }

    async findByProviderAndUserIdWithMember(provider: string, providerUserId: string): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { provider, provider_user_id: providerUserId }, relations: ["member"] });
    }

    async findByMemberEmailPassword(memberId: number): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { member_id: memberId, provider: "email_verification" } });
    }

    async createPasswordLogin(memberId: number, hashedPassword: string): Promise<MemberLoginsEntity> {
        const record = this.entity.create({ member_id: memberId, provider: "email_verification", password: hashedPassword });
        return await this.entity.save(record);
    }

    async updatePasswordLogin(memberId: number, hashedPassword: string): Promise<void> {
        const login = await this.findByMemberEmailPassword(memberId);
        if (login) {
            await this.entity.update(login.id, { password: hashedPassword });
        } else {
            await this.createPasswordLogin(memberId, hashedPassword);
        }
    }

    async clearResetTokens(memberId: number): Promise<void> {
        await this.entity.delete({ member_id: memberId, provider: "email_verification" });
    }

    async findByResetCode(memberId: number, resetCode: string): Promise<MemberLoginsEntity | null> {
        return await this.entity.findOne({ where: { member_id: memberId, provider: "email_verification", access_token: resetCode } });
    }
}

export default MemberLoginsService;