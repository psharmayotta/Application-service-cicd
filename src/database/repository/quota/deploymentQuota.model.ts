import { QuotaStatus } from "../../../config";
import { InferModel } from "../InferModel/InferModel.model";

export class DeploymentQuotaModel extends InferModel {
  model_id: number = 0;
  tpm_limit: number = 0;
  rpm_limit: number = 0;
  company_id: number = 0;
  extended_tpm_limit: number = 0;
  extended_rpm_limit: number = 0;
  is_default: number = 1;
  status: QuotaStatus = QuotaStatus.PENDING;
  reason: string = '';
  requested_by: number = 0;
  decryptToken: any = null;
  request_for: string = '';
  module_type: string = '';
}
