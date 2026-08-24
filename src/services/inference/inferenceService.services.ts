import { AwsService } from "../../core/AwsService";
import { BaseServices } from "../baseService.services";
import { EncryptionAndDecryption } from '../../core/Encryption&Decryption';
import { verifyjwt } from '../../utils/jwt/jwt';
import { ModelDto } from "../../database/repository/model/model.dto";
import { Model } from "../../database/repository/model/model.model";
import { InfraAllocationEntity } from "../../entities/infraAllocationEntity";
import grpc from "@grpc/grpc-js";
import { GRPC_CALL_TIMEOUT_MS, JsonArray, JsonObject, JsonValue, ReplaceOptions } from '../../config';
import { ModelEntity } from "../../entities/modelEntity";
import { ChatSessionEntity } from "../../entities/chatSessionEntity";
import { ChatEntity } from "../../entities/chatEntity";
import { ModelTaskEntity } from "../../entities/modelTaskEntity";
import { extractLastAssistantReply, formatLlamaChat, formatMistralChat, formatOssChat } from "../../utils/textgeneration/textgeneration.util";
import AuditLogService from "../auditLog/auditLogService.services";
const axios = require('axios');
import { ReadableStream } from 'stream/web';
import { PassThrough, Readable } from "stream";
import DeploymentQuotaUsageService from "../quota/deploymentQuotaUsageService.services";

const protoLoader = require('@grpc/proto-loader');

export class InferenceService extends BaseServices {
  clientCache = new Map();
  constructor(entity: any = InfraAllocationEntity, protected awsService: AwsService = new AwsService()) {
    super(entity, awsService);
  }

  getModel(): Model {
    return new Model();
  }

  getDTO(): any {
    return ModelDto;
  }


  inference = async (modelId, api_key, body, sessionId, companyId, memberId) => {
    const allocationDetail = await this.getAllocationConfig(modelId.id);

    // Create or load chat session
    let chatSession = await ChatSessionEntity.findOneBy({ session_id: sessionId });
    if (!chatSession) {
      chatSession = ChatSessionEntity.create({
        member_id: memberId,
        company_id: companyId,
        session_id: sessionId.toString(),
        api_key,
        model_id: modelId.id,
        session_start_time: new Date(),
      });
      await ChatSessionEntity.save(chatSession);
    }

    let userMessage = "";

    if (allocationDetail.task_name === "Text generation") {
      const pastChats = await ChatEntity.find({
        where: { chat_session_id: sessionId },
        order: { created_at: "ASC" },
      });

      const messages = pastChats.flatMap(chat => {
        const arr: { role: "user" | "assistant"; content: string }[] = [];
        arr.push({ role: "user", content: chat.user_message });
        if (chat.bot_response) {
          arr.push({ role: "assistant", content: chat.bot_response });
        }
        return arr;
      });

      userMessage = body.TextInput || body.text_input || "";
      messages.push({ role: "user", content: userMessage });
      let prompt: string;
      if (/mistral/i.test(allocationDetail.model_name)) {
        prompt = formatMistralChat(messages);
      } else if (/oss/i.test(allocationDetail.model_name)) {
        prompt = formatOssChat(messages);
      } else {
        prompt = formatLlamaChat(messages);
      }

      body.text_input = prompt;
    }
    if (allocationDetail.model_protocol === "GRPC") {
      return this.grpcConnection(body, allocationDetail);
    } else {
      const { stream, headers } = await this.getHttpClient(body, allocationDetail);

      if (!stream || !(stream instanceof Readable)) {
        throw new Error(
          `Invalid stream: Expected Node.js Readable, got ${stream?.constructor?.name || typeof stream}`
        );
      }

      // Save user message immediately
      const chat = ChatEntity.create({
        chat_session_id: sessionId,
        company_id: companyId,
        user_message: userMessage,
        bot_response: null,
      });
      await ChatEntity.save(chat);

      // Stream handling
      const passThrough = new PassThrough();
      let accumulatedResponse = "";

      stream.on("data", (chunk) => {
        const chunkString = chunk.toString("utf-8");
        if (chunkString.startsWith("data: ")) {
          const jsonString = chunkString.replace(/^data: /, "").trim();
          if (jsonString) {
            try {
              const parsed = JSON.parse(jsonString);
              if (parsed.text_output) {
                accumulatedResponse += parsed.text_output;
              }
            } catch (error) {
              console.error("Error parsing JSON chunk:", jsonString, error);
            }
          }
        }
        passThrough.write(chunk);
      });

      stream.on("end", async () => {
        chat.bot_response = accumulatedResponse;
        await ChatEntity.save(chat).catch(err =>
          console.error("Error saving ChatEntity:", err)
        );
        passThrough.end();
      });

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        passThrough.emit("error", err);
      });

      return { stream: passThrough, headers };
    }
  };

  inferenceNew = async (
    modelId,
    api_key,
    body,
    sessionId,
    companyId,
    memberId
  ) => {
    // 1. Allocation config
    // const validateAndConsumeRPMTPM = new DeploymentQuotaUsageService()
    // await validateAndConsumeRPMTPM.validateAndConsumeRPM(modelId.id, memberId);
    const allocationDetail = await this.getAllocationConfig(modelId.id);

    // 2. Ensure chat session exists
    let chatSession = await ChatSessionEntity.findOneBy({ session_id: sessionId });
    if (!chatSession) {
      chatSession = ChatSessionEntity.create({
        member_id: memberId,
        company_id: companyId,
        session_id: sessionId.toString(),
        api_key,
        model_id: modelId.id,
        session_start_time: new Date(),
      });
      await ChatSessionEntity.save(chatSession);
    }

    let payload: any;
    let userMessage = "";

    // ----------------------------
    // TEXT GENERATION (Chat style)
    // ----------------------------
    if (allocationDetail.task_name === "Text generation") {
      const pastChats = await ChatEntity.find({
        where: { chat_session_id: sessionId },
        order: { created_at: "ASC" },
      });

      const messages = pastChats.flatMap(chat => {
        const arr: { role: "user" | "assistant"; content: string }[] = [];
        arr.push({ role: "user", content: chat.user_message });
        if (chat.bot_response) {
          arr.push({ role: "assistant", content: chat.bot_response });
        }
        return arr;
      });

      userMessage = body.TextInput || body.text_input || "";
      messages.push({ role: "user", content: userMessage });

      let prompt: string;
      if (/mistral/i.test(allocationDetail.model_name)) {
        prompt = formatMistralChat(messages);
      } else if (/oss/i.test(allocationDetail.model_name)) {
        prompt = formatOssChat(messages);
      } else {
        prompt = formatLlamaChat(messages);
      }

      body.text_input = prompt;
      payload = this.buildInferencePayload(allocationDetail.model_input, body);
    } else {
      userMessage = body;
      payload = this.buildInferencePayload(allocationDetail.model_input, body);
    }

    // 3. Call model
    if (allocationDetail.model_protocol === "GRPC") {
      return this.grpcConnection(payload, allocationDetail);
    } else {
      const { stream, headers } = await this.getHttpClient(payload, allocationDetail);

      if (!stream || !(stream instanceof Readable)) {
        throw new Error(
          `Invalid stream: Expected Node.js Readable, got ${stream?.constructor?.name || typeof stream}`
        );
      }

      // Save user message immediately
      const chat = ChatEntity.create({
        chat_session_id: sessionId,
        company_id: companyId,
        user_message: userMessage,
        bot_response: null,
      });
      await ChatEntity.save(chat);

      // Stream handling
      const passThrough = new PassThrough();
      let accumulatedResponse = "";

      stream.on("data", (chunk) => {
        const chunkString = chunk.toString("utf-8");
        if (chunkString.startsWith("data: ")) {
          const jsonString = chunkString.replace(/^data: /, "").trim();
          if (jsonString) {
            try {
              const parsed = JSON.parse(jsonString);
              if (parsed.text_output) {
                accumulatedResponse += parsed.text_output;
              }
            } catch (error) {
              console.error("Error parsing JSON chunk:", jsonString, error);
            }
          }
        }
        passThrough.write(chunk);
      });

      stream.on("end", async () => {
        let botReply = accumulatedResponse;
        if (allocationDetail.task_name === "Text generation") {
          botReply = extractLastAssistantReply(accumulatedResponse);
        }

        chat.bot_response = botReply;
        await ChatEntity.save(chat).catch(err =>
          console.error("Error saving ChatEntity:", err)
        );
        // await validateAndConsumeRPMTPM.consumeTPM(chat.id);
        passThrough.end();
      });

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        passThrough.emit("error", err);
      });

      return { stream: passThrough, headers };
    }
  };


  escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  replacePlaceholders(
    template: JsonValue,
    values: Record<string, JsonValue>,
    options: ReplaceOptions = { parseReplacedJson: false }
  ): JsonValue {
    // sort keys by length so "top_p" won't be partially replaced by "top"
    const keysSorted = Object.keys(values).sort((a, b) => b.length - a.length);

    const _replace = (node: JsonValue): JsonValue => {
      // string node
      if (typeof node === "string") {
        // 1) Exact match → return raw value (preserves type)
        for (const k of keysSorted) {
          if (node === k) return values[k];
        }

        // 2) Otherwise, safe replacements inside the string
        let replaced = node;

        for (const k of keysSorted) {
          const val = values[k];
          const valJson = JSON.stringify(val);

          // Replace unquoted value after a colon
          const reUnquotedAfterColon = new RegExp(
            "(:\\s*)" + this.escapeRegExp(k) + "(?=\\s*[,\\}])",
            "g"
          );
          replaced = replaced.replace(reUnquotedAfterColon, (_, p1) => p1 + valJson);

          // Replace quoted value after a colon
          const reQuotedAfterColon = new RegExp(
            '(:\\s*)"' + this.escapeRegExp(k) + '"(?=\\s*[,\\}])',
            "g"
          );
          replaced = replaced.replace(reQuotedAfterColon, (_, p1) => p1 + valJson);
        }

        // 3) Optionally parse replaced string if it looks like JSON
        if (options.parseReplacedJson) {
          const t = replaced.trim();
          if (
            (t.startsWith("{") && t.endsWith("}")) ||
            (t.startsWith("[") && t.endsWith("]"))
          ) {
            try {
              return JSON.parse(replaced);
            } catch {
              // parsing failed → fall through
            }
          }
        }

        return replaced;
      }

      // array node
      if (Array.isArray(node)) {
        return node.map((item) => _replace(item)) as JsonArray;
      }

      // object node
      if (node !== null && typeof node === "object") {
        const out: JsonObject = {};
        for (const key of Object.keys(node)) {
          out[key] = _replace((node as JsonObject)[key]);
        }
        return out;
      }

      // primitive (number/boolean/null)
      return node;
    };

    return _replace(template);
  }

  private buildInferencePayload = (template: any, body: Record<string, any>) => {
    return this.replacePlaceholders(template, body);
  }



  // private buildInferencePayload = (template: any, body: Record<string, any>) => {
  //   const replacer = (value: any): any => {
  //     if (typeof value === "string") {
  //       let replaced = value;
  //       for (const [key, val] of Object.entries(body)) {
  //         // Escape regex chars in key
  //         const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  //         const exactRegex = new RegExp(`^${safeKey}$`); 
  //         const inlineRegex = new RegExp(`(?<![A-Za-z0-9_])${safeKey}(?![A-Za-z0-9_])`, "g");

  //         if (exactRegex.test(replaced)) {
  //           // If the entire string is just the key → replace with raw value
  //           return val;
  //         } else {
  //           // Otherwise replace inline occurrences
  //           replaced = replaced.replace(inlineRegex, JSON.stringify(val));
  //         }
  //       }
  //       return replaced;
  //     }

  //     if (Array.isArray(value)) {
  //       return value.map(replacer);
  //     }

  //     if (typeof value === "object" && value !== null) {
  //       return Object.fromEntries(
  //         Object.entries(value).map(([k, v]) => [k, replacer(v)])
  //       );
  //     }

  //     return value;
  //   };

  //   return replacer(template);
  // };




  grpcConnection = async (body, allocationDetail) => {
    try {
      const client = this.getGrpcClient(allocationDetail.model_proxy);
      const deadline = new Date(Date.now() + GRPC_CALL_TIMEOUT_MS);
      client.Infer({ body }, { deadline }, (err, resp) => {
        if (err) { }
        return { output: resp.output, score: resp.score };
      });
    } catch (e) {
      throw e;
    }
  }


  getHttpClientNew = async (input, allocationDetail) => {
    const response = await axios.post(allocationDetail.model_proxy, input, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  };

  getHttpClient = async (input, allocationDetail) => {
    const response = await axios({
      method: "post",
      url: allocationDetail.model_proxy,
      data: input,
      responseType: "stream"
    });
    return {
      stream: response.data,
      headers: response.headers
    };
  }


  scheduleDestroy(host, client) {

  }

  serialize(data) {
    return Buffer.from(JSON.stringify(data));
  }

  deserialize(buffer) {
    return JSON.parse(buffer.toString());
  }

  loadGRPC_Config = () => {
    const InferenceService = {
      Infer: {
        path: "/InferenceService/Infer",
        requestStream: false,
        responseStream: false,
        requestSerialize: this.serialize,
        requestDeserialize: this.deserialize,
        responseSerialize: this.serialize,
        responseDeserialize: this.deserialize,
      },
    };

    // Create client constructor dynamically
    const ClientCtor = grpc.makeGenericClientConstructor(
      InferenceService,
      "InferenceService"
    );
    return ClientCtor;
  }

  getGrpcClient(host) {
    const existing = this.clientCache.get(host);
    if (existing) {
      clearTimeout(existing.timer);
      existing.timer = this.scheduleDestroy(host, existing.client);
      existing.usageCount = (existing.usageCount || 0) + 1;
      return existing.client;
    }
    const proto = this.loadGRPC_Config()
    const client = new proto(host, grpc.credentials.createInsecure());
    const timer = this.scheduleDestroy(host, client);
    const entry = { client, timer, usageCount: 1 };
    this.clientCache.set(host, entry);
    return client;
  }



  getAllocationConfig = async (modelId: string) => {
    try {
      // Base allocation record
      const record = await this.entity.findOneBy({ module_id: modelId, is_delete: 0, module_type: 'model' });
      if (!record) {
        throw new Error(`No allocation record found for modelId: ${modelId}`);
      }

      // Model input/output info
      const modelRecord = await ModelEntity.findOne({
        where: { id: Number(modelId) },
        select: ["model_input", "model_output", "model_task_id", "name"],
      });

      const taskData = await ModelTaskEntity.findOne({
        where: { id: modelRecord?.model_task_id },
        select: ["name"],
      });

      return {
        ...record,
        model_name: modelRecord?.name ?? null,
        model_input: typeof modelRecord?.model_input === "string" ? JSON.parse(modelRecord.model_input) : modelRecord?.model_input,
        model_output: typeof modelRecord?.model_output === "string" ? JSON.parse(modelRecord.model_output) : modelRecord?.model_output,
        task_name: taskData?.name ?? null,
      };
    } catch (e) {
      throw e;
    }
  };



  processInference(inputData: any, modelId: string, apiKey: string, sessionId: string) {
    const decryptedInput = EncryptionAndDecryption.decryption(modelId);
    const decryptedApiKey = verifyjwt(apiKey);
    const companyId = typeof decryptedApiKey === 'string' ? undefined : decryptedApiKey.company_id;
    const memberId = typeof decryptedApiKey === 'string' ? undefined : decryptedApiKey.member_id;
    return this.inference(decryptedInput, decryptedApiKey, inputData, sessionId, companyId, memberId);
  }

  processInferenceNew(inputData: any, modelId: string, apiKey: string, sessionId: string) {
    const decryptedInput = EncryptionAndDecryption.decryption(modelId);
    const decryptedApiKey = verifyjwt(apiKey);
    const companyId = typeof decryptedApiKey === 'string' ? undefined : decryptedApiKey.company_id;
    const memberId = typeof decryptedApiKey === 'string' ? undefined : decryptedApiKey.member_id;
    return this.inferenceNew(decryptedInput, apiKey, inputData, sessionId, companyId, memberId);
  }

  async logInferenceFailure(modelId: string, apiKey: string, error: any, sessionId?: string) {
    try {
      const decryptedInput = EncryptionAndDecryption.decryption(modelId);
      const decryptedApiKey: any = verifyjwt(apiKey);
      const companyId = typeof decryptedApiKey === 'string' ? null : decryptedApiKey.company_id;
      const memberId = typeof decryptedApiKey === 'string' ? null : decryptedApiKey.member_id;

      let allocationDetail: any = null;
      if (decryptedInput?.id) {
        try {
          allocationDetail = await this.getAllocationConfig(decryptedInput.id);
        } catch (_allocationError) {
          allocationDetail = null;
        }
      }

      await AuditLogService.logFailureIncident({
        company_id: companyId,
        member_id: memberId,
        module: 'Inference',
        entity_type: 'InfraAllocationEntity',
        entity_id: allocationDetail?.id,
        entity_name: allocationDetail?.deployment_name || allocationDetail?.model_name || `Model-${decryptedInput?.id ?? 'Unknown'}`,
        description: 'Inference request failed',
        reason: error,
        metadata: {
          session_id: sessionId,
          model_id: decryptedInput?.id,
          allocation_id: allocationDetail?.id,
        },
      });
    } catch (auditError) {
      console.error('Inference failure audit log error:', auditError);
    }
  }

}
