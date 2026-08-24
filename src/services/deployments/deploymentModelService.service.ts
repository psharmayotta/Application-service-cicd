import { In, IsNull, Not } from "typeorm";
import { AwsService } from "../../core/AwsService";
import { Pagination } from "../../core/InferParams";
import { PlaygroundDto } from "../../database/repository/playground/playground.dto";
import { PlaygroundModel } from "../../database/repository/playground/playground.model";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import { ModelCategoryEntity } from "../../entities/modelCategoryEntity";
import { ModelEntity } from "../../entities/modelEntity";
import { ModelProviderEntity } from "../../entities/modelProviderEntity";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { ModelTrainingEntity } from "../../entities/modelTrainingEntity";
import { CloudProviderEntity } from "../../entities/cloudProviderEntity";
import { BaseServices } from "../baseService.services";
import { MyModelStatus, ModelModuleType, ModelTrainingStatus } from "../../config";
import { NimModelEntity } from "../../entities/nimModelEntity";

class DeploymentModelService extends BaseServices {
  constructor(
    entity: any = ModelEntity,
    protected awsService: AwsService = new AwsService()
  ) {
    super(entity, awsService);
  }

  getModel(): PlaygroundModel {
    return new PlaygroundModel();
  }

  getDTO(): any {
    return PlaygroundDto;
  }

  getModuleName(): string {
    return "Deployment Model";
  }

  async prepareQuery(param: Pagination): Promise<any[]> {
    try {
      console.log("-----------------------", param);

      // Query for playground models
      const playgroundModels = await this.entity.find({
        where: {
          is_delete: 0,
          allow_playground: true,
          id: In(
            await InfraAllocationEntity.find({
              select: ["module_id"],
              where: { is_delete: 0 },
            }).then((allocations) => allocations.map((a) => a.module_id))
          ),
        },
        order: { model_rank: "ASC" },
      });

      // Query for company models (exclude Docker models)
      const companyModels = await this.entity.find({
        where: {
          company_id: param.company_id,
          status: MyModelStatus.MODEL_READY,
          is_delete: 0,
          is_docker: false,
        },
        order: { model_rank: "ASC" },
      });

      // Process playground models with module: PLAYGROUND
      const playgroundResults = await Promise.all(
        playgroundModels.map(async (model: any) => {
          const task_entity = await ModelTaskEntity.findOneBy({
            id: model.model_task_id,
            is_delete: 0,
          });
          const model_category = await ModelCategoryEntity.findOneBy({
            id: model.model_category_id,
            is_delete: 0,
          });
          const model_provider = await ModelProviderEntity.findOneBy({
            id: model.model_provider_id,
            is_delete: 0,
          });

          return {
            id: model.id,
            name: model.name,
            task_name: task_entity ? task_entity.name : null,
            model_category: model_category ? model_category.name : null,
            model_category_id: model.model_category_id || null,
            model_provider_icon:
              model_provider && model_provider.model_provider_icon
                ? await this.generateSignedUrl(
                  "modelProviderMedia",
                  model_provider.id,
                  model_provider.model_provider_icon
                )
                : null,
            description: model.description,
            module: ModelModuleType.PLAYGROUND,
          };
        })
      ).then((results) => results.filter(Boolean));

      // Process company models with module: MYMODEL
      const companyResults = await Promise.all(
        companyModels.map(async (model: any) => {
          let sourceModel = model;
          if (model.model_class_id) {
            const baseModel = await ModelEntity.findOne({
              where: {
                model_class_id: model.model_class_id,
                company_id: IsNull(),
                member_id: IsNull(),
                is_delete: 0
              }
            });
            if (baseModel) {
              sourceModel = baseModel;
            }
          }

          const task_entity = await ModelTaskEntity.findOneBy({
            id: sourceModel.model_task_id,
            is_delete: 0,
          });
          const model_category = await ModelCategoryEntity.findOneBy({
            id: sourceModel.model_category_id,
            is_delete: 0,
          });

          const model_provider = await ModelProviderEntity.findOneBy({
            id: sourceModel.model_provider_id,
            is_delete: 0,
          });

          return {
            id: model.id,
            name: model.name,
            task_name: task_entity ? task_entity.name : null,
            model_category: model_category ? model_category.name : null,
            model_category_id: sourceModel.model_category_id || null,
            model_provider_icon:
              model_provider && model_provider.model_provider_icon
                ? await this.generateSignedUrl(
                  "modelProviderMedia",
                  model_provider.id,
                  model_provider.model_provider_icon
                )
                : null,
            description: model.description,
            module: ModelModuleType.MYMODEL,
          };
        })
      ).then((results) => results.filter(Boolean));

      const trainingModels = await ModelTrainingEntity.find({
        where: {
          company_id: param.company_id,
          status: ModelTrainingStatus.COMPLETED,
          is_delete: 0,
        },
      });

      // Process training models
      const trainingResults = await Promise.all(
        trainingModels.map(async (model: any) => {
          const task_entity = await ModelTaskEntity.findOneBy({
            id: model.model_task_type_id,
            is_delete: 0,
          });
          const model_category = await ModelCategoryEntity.findOneBy({
            id: model.model_category_id,
            is_delete: 0,
          });

          const baseModel = await ModelEntity.findOneBy({ id: model.model_id });
          let providerId = baseModel ? baseModel.model_provider_id : null;

          const model_provider = providerId ? await ModelProviderEntity.findOneBy({
            id: providerId,
            is_delete: 0,
          }) : null;

          return {
            id: model.id,
            name: model.name,
            task_name: task_entity ? task_entity.name : null,
            model_category: model_category ? model_category.name : null,
            model_category_id: model.model_category_id || null,
            model_provider_icon:
              model_provider && model_provider.model_provider_icon
                ? await this.generateSignedUrl(
                  "modelProviderMedia",
                  model_provider.id,
                  model_provider.model_provider_icon
                )
                : null,
            description: model.description,
            module: ModelModuleType.TRAINING,
          };
        })
      ).then((results) => results.filter(Boolean));

      // Query and process Docker models only when module=deployment
      let dockerResults: any[] = [];
      if ((param as any).module && (param as any).module.toLowerCase() === 'deployment') {
        const dockerModels = await this.entity.find({
          where: {
            company_id: param.company_id,
            status: MyModelStatus.MODEL_READY,
            is_docker: true,
            is_delete: 0,
          },
          order: { model_rank: "ASC" },
        });

        dockerResults = await Promise.all(
          dockerModels.map(async (model: any) => {
            // For Docker models, resolve task/category from model_class base model if available
            let sourceModel = model;
            if (model.model_class_id) {
              const baseModel = await ModelEntity.findOne({
                where: {
                  model_class_id: model.model_class_id,
                  company_id: IsNull(),
                  member_id: IsNull(),
                  is_delete: 0
                }
              });
              if (baseModel) {
                sourceModel = baseModel;
              }
            }

            const task_entity = await ModelTaskEntity.findOneBy({
              id: sourceModel.model_task_id,
              is_delete: 0,
            });
            const model_category = await ModelCategoryEntity.findOneBy({
              id: sourceModel.model_category_id,
              is_delete: 0,
            });

            // For Docker models, use cloud provider icon instead of model provider
            const cloudProvider = await CloudProviderEntity.findOneBy({
              id: model.cloud_provider_id,
              is_delete: 0,
            });

            const model_provider = sourceModel.model_provider_id
              ? await ModelProviderEntity.findOneBy({
                id: sourceModel.model_provider_id,
                is_delete: 0,
              })
              : null;

            return {
              id: model.id,
              name: model.name,
              task_name: task_entity ? task_entity.name : null,
              model_category: model_category ? model_category.name : null,
              model_category_id: sourceModel.model_category_id || null,
              model_provider_icon:
                model_provider && model_provider.model_provider_icon
                  ? await this.generateSignedUrl(
                    "modelProviderMedia",
                    model_provider.id,
                    model_provider.model_provider_icon
                  )
                  : null,
              description: model.description,
              module: ModelModuleType.DOCKER,
            };
          })
        ).then((results) => results.filter(Boolean));
      }

      // NIM (NVIDIA NIM) models from the nim_model DB table,
      // only surfaced for the deployment module.
      let nimResults: any[] = [];
      if ((param as any).module && (param as any).module.toLowerCase() === 'deployment') {
        nimResults = await this.buildNimResults();
      }

      const combinedResults = [...playgroundResults, ...companyResults, ...trainingResults, ...dockerResults, ...nimResults];

      return combinedResults;
    } catch (error) {
      console.error("Error in prepareQuery:", error);
      throw error;
    }
  }

  /**
   * Builds the NIM (NVIDIA NIM) model list from the nim_model DB table.
   * Each entry carries the publisher icon, resolved from ModelProviderEntity
   * via the model_provider_id FK stored on the nim_model row.
   */
  private async buildNimResults(): Promise<any[]> {
    const nimModels = await NimModelEntity.find({
      where: { is_delete: 0, status: true },
    });

    // Cache signed icon URLs per provider id to avoid redundant S3 calls.
    const iconCache = new Map<number, string | null>();

    return Promise.all(
      nimModels.map(async (model) => {
        let providerIcon: string | null = null;

        if (model.model_provider_id) {
          if (iconCache.has(model.model_provider_id)) {
            providerIcon = iconCache.get(model.model_provider_id) ?? null;
          } else {
            const provider = await ModelProviderEntity.findOneBy({
              id: model.model_provider_id,
              is_delete: 0,
            });
            providerIcon = provider && provider.model_provider_icon
              ? await this.generateSignedUrl(
                "modelProviderMedia",
                provider.id,
                provider.model_provider_icon
              )
              : null;
            iconCache.set(model.model_provider_id, providerIcon);
          }
        }

        return {
          id: model.id,
          name: model.name,
          task_name: null,
          model_category: model.category,
          model_category_id: null,
          model_provider_icon: providerIcon,
          description: null,
          image: model.image,
          publisher: model.publisher,
          module: ModelModuleType.NIM,
        };
      })
    );
  }
}

export default DeploymentModelService;
