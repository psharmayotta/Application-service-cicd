import { InviteEntity } from "../../entities/inviteEntity";
import { BaseServices } from "../baseService.services";
import { AwsService } from "../../core/AwsService";
import { v4 as uuidv4 } from "uuid";
import { InviteDto } from "../../database/repository/invite/invite.dto";
import { InviteModel } from "../../database/repository/invite/invite.model";
import Database from "../../database/database";
import { MembersEntity } from "../../entities/membersEntity";
import { CompanyEntity } from "../../entities/companyEntity";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { HuggingFaceRepoVerificationModel } from "../../database/repository/huggingFaceRepoVerification/huggingFaceRepoVerify.model";
import { HuggingFaceRepoVerificationDto } from "../../database/repository/huggingFaceRepoVerification/huggingFaceRepoVerify.dto";
import axios from "axios";
import { HUGGINGFACE_API_KEY, HUGGINGFACE_API_URL } from "../../config";
import { resolve } from "path";
import { ModelClassEntity } from "../../entities/modelClassEntity";

class HuggingFaceRepoVerificationService extends BaseServices {
  constructor(
    entity: any = ModelClassEntity,
    protected awsService: AwsService = new AwsService()
  ) {
    super(entity, awsService);
  }

  getModel(): HuggingFaceRepoVerificationModel {
    return new HuggingFaceRepoVerificationModel();
  }
  getDTO(): any {
    return HuggingFaceRepoVerificationDto;
  }

  getModuleName(): string {
    return "Hugging Face Repo Verification";
  }

  async verifyRepo(model: HuggingFaceRepoVerificationModel): Promise<any> {
    if (!model.repository_url || !/^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/.test(model.repository_url.trim())) {
      return Promise.reject('E10004');
    }
    const repoUrl = `${HUGGINGFACE_API_URL}/api/models/${model.repository_url.trim()}`;
    try {
      const response = await axios.get(repoUrl, {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        },
      });

      if (response.status === 200) {
        const data = response.data;
        // Extract model class name from config
        let modelClass: string | undefined;

        if (data.config?.diffusers?._class_name) {
          // For models like FLUX.1-dev
          modelClass = data.config.diffusers._class_name;
        } else if (
          data.config?.architectures &&
          Array.isArray(data.config.architectures)
        ) {
          // For models like tiny-random-BertForMaskedLM
          modelClass = data.config.architectures[0];
        }

        if (model.repository_url.trim() === "hexgrad/Kokoro-82M") {
          modelClass = "KokoroForTextToSpeech";
        }

        // Fallback: If config is empty (common for gated models), try to infer from
        // library_name + pipeline_tag, or fetch model_index.json directly
        if (!modelClass && data.library_name === "diffusers") {
          // Try fetching model_index.json directly to get the _class_name
          try {
            const modelIndexUrl = `${HUGGINGFACE_API_URL}/${data.modelId}/resolve/main/model_index.json`;
            const indexResponse = await axios.get(modelIndexUrl, {
              headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
            });
            if (indexResponse.status === 200 && indexResponse.data?._class_name) {
              modelClass = indexResponse.data._class_name;
              console.log(`[HF Verify] Resolved modelClass from model_index.json: ${modelClass}`);
            }
          } catch (indexError) {
            console.log(`[HF Verify] Could not fetch model_index.json for ${data.modelId}, using pipeline_tag fallback`);
          }

          // Final fallback: map known pipeline_tag values to class names
          if (!modelClass && data.pipeline_tag) {
            const pipelineTagToClass: Record<string, string> = {
              "text-to-image": "StableDiffusion3Pipeline",
              "image-to-image": "StableDiffusionImg2ImgPipeline",
            };
            modelClass = pipelineTagToClass[data.pipeline_tag];
            if (modelClass) {
              console.log(`[HF Verify] Resolved modelClass from pipeline_tag '${data.pipeline_tag}': ${modelClass}`);
            }
          }
        }

        if (!modelClass) {
          return Promise.resolve(false);
        }

        const modelConfigDetails = await this.fetchHuggingFaceModelConfig(
          data.modelId,
          modelClass
        );
        // Query the ModelClassEntity table to check if the model class exists
        const modelClassEntity = await this.entity.findOne({
          where: { name: modelClass },
        });

        // Check if model class exists in the table
        if (modelClassEntity) {
          let config = modelConfigDetails ? modelConfigDetails : null;
          if (modelClass.trim() === "StableDiffusion3Pipeline") {
            config = modelClassEntity.model_configuration;
          }
          const model = {
            id: modelClassEntity.id,
            name: modelClassEntity.name,
            description: modelClassEntity.description,
            config: modelConfigDetails ? modelConfigDetails : null,
          };
          return Promise.resolve(model);
        }
        return Promise.resolve(false);
      }
      return Promise.resolve(false);
      return Promise.resolve(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return Promise.resolve(false);
        }
        console.error("Error verifying repository:", error.message);
      }
      return Promise.resolve(false);
    }
  }

  async verifyDatasetRepo(model: HuggingFaceRepoVerificationModel): Promise<any> {
    if (!model.repository_url || !/^[a-zA-Z0-9_\-\.]+\/[a-zA-Z0-9_\-\.]+$/.test(model.repository_url.trim())) {
      return Promise.reject('E10004');
    }
    const repoUrl = `${HUGGINGFACE_API_URL}/api/datasets/${model.repository_url.trim()}`;
    try {
      const response = await axios.get(repoUrl, {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        },
      });
      console.log("response", response.data);
      if (response.status === 200) {
        return Promise.resolve(response.data);
      }
      return Promise.resolve(false);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return Promise.resolve(false);
        }
        console.error("Error verifying dataset repository:", error.message);
      }
      return Promise.resolve(false);
    }
  }

  public fetchHuggingFaceModelConfig(model_name: string, modelClass?: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let data = null;
      try {
        let configFileName = "config.json";
        if (modelClass === "StableDiffusion3Pipeline" || modelClass === "FluxKontextPipeline" || modelClass === "FluxPipeline") {
          configFileName = "model_index.json";
        }
        const modelConfigUrl = `${HUGGINGFACE_API_URL}/${model_name}/resolve/main/${configFileName}`;
        const response = await axios.get(modelConfigUrl, {
          headers: {
            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          },
        });
        if (response.status === 200) {
          data = response.data;
          resolve(data);
        } else {
          console.log(
            "---failed to fetch model config from hugging face----",
            response.status
          );
          resolve(data);
        }
      } catch (error) {
        console.log(
          "------HuggingFaceRepoVerificationService.fetchHuggingFaceModelConfig--------",
          error
        );
        resolve(data);
      }
    });
  }
}
export default HuggingFaceRepoVerificationService;
