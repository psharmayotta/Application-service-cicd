import { AwsService } from '../../core/AwsService';
import { BaseServices } from '../baseService.services';
import { BudgetAlertHistoryEntity } from '../../entities/budgetAlertHistoryEntity';
import { BudgetAlertHistoryModel } from '../../database/repository/budgetAlertHistory/budgetAlertHistory.model';
import { BudgetAlertHistoryDto } from '../../database/repository/budgetAlertHistory/budgetAlertHistory.dto';

export class BudgetAlertHistoryService extends BaseServices {
  constructor(entity: any = BudgetAlertHistoryEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): BudgetAlertHistoryModel {
    return new BudgetAlertHistoryModel();
  }

  getDTO() {
    return BudgetAlertHistoryDto;
  }

  getModuleName(): string {
    return 'Budget Alert History';
  }
}

export default BudgetAlertHistoryService;
