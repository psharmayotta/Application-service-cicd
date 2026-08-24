import express from "express";
import * as Sentry from "@sentry/node";
import { initSentry } from "./utils/sentry";
import http from "http";
import Database from "./database/database";
import {
  ENABLE_ENCRYPTION,
  NON_ENCRYPTION_ENDPOINTS,
  PATH,
  PORT,
  StatusCode,
  WEBSOCKET_PATH,
  WEBSOCKET_PORT,
  DEV_URL,
  FRONTENDDOMAIN,
} from "./config";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json";
import { BaseController } from "./controllers/baseController.controller";
import {
  ApiError,
  BadRequestError,
  MethodNotFoundError,
  NotFoundError,
} from "./core/ApiError";
import multer from "multer";
import helmet from "helmet";
import { KafkaService } from "./utils/kafka/KafkaService";
import { EncryptionAndDecryption } from "./core/Encryption&Decryption";
import cors from "cors";
import { Message } from "node-rdkafka";
import { kafkaConsumers } from "./utils/kafka/consumers";
import { WebSocketService } from "./utils/webSocket/webSocketService";
import { requestTraceMiddleware } from "./middlewares/requestTrace.middleware";

export class App {
  public app: express.Application;
  public server: http.Server;
  public port: any;
  private pathList: any[] = [];
  private database = Database.getInstance();

  constructor(controllers: BaseController[], port: any) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.port = port;
    this.initializeSentry();
    this.initializeDatabase();
    this.initializeFirebase();
    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
    this.initializeWebSocketServerOnSeparatePort();
    this.initializeKafka().catch((err) => {
      console.error("Kafka initialization failed:", err);
      process.exit(1);
    });
  }

  private initializeSentry() {
    initSentry();
  }

  private initializeDatabase() {
    this.database.connectToDB();
  }

  private initializeFirebase() {
    // Initialize Firebase
    // firebase.initializeApp(firebaseConfig);
  }

  private initializeMiddlewares() {
    this.app.use(requestTraceMiddleware);
    const swaggerOptions = {
      customJs: "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js",
      swaggerOptions: {
        requestInterceptor: (req: any) => {
          if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
            const excludeList = [
              '/security/saltencryption',
              '/security/encryption',
              '/security/decryption',
              '/inference',
              '/model/my-model/update-status',
              '/model-training/update-status',
              '/dataset/update-status',
              '/company-member-roles/approve',
              '/company-member-roles/reject',
              '/importExcel'
            ];
            const shouldExclude = excludeList.some(path => req.url.includes(path));
            if (!shouldExclude) {
              try {
                let parsedBody = req.body;
                if (typeof parsedBody === 'string') {
                  parsedBody = JSON.parse(parsedBody);
                }
                if (parsedBody && parsedBody.data && Object.keys(parsedBody).length === 1) {
                  return req;
                }
                const crypto = (window as any).CryptoJS;
                if (crypto) {
                  const secretKey = 'YOTTA2024';
                  const iv = crypto.enc.Hex.parse("101112131415161718191a1b1c1d1e1f");
                  const encrypted = crypto.AES.encrypt(JSON.stringify(parsedBody), secretKey, {
                    mode: crypto.mode.CTR,
                    iv: iv
                  }).toString();
                  req.body = JSON.stringify({ data: encrypted });
                }
              } catch (e) {
                console.error("Swagger request encryption failed:", e);
              }
            }
          }
          return req;
        },
        responseInterceptor: (res: any) => {
          try {
            let parsedRes = null;
            if (res.obj) {
              parsedRes = res.obj;
            } else if (res.body) {
              parsedRes = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
            } else if (res.text) {
              parsedRes = JSON.parse(res.text);
            }
            if (parsedRes) {
              let encryptedVal = null;
              let keyToUse = null;
              if (typeof parsedRes.details === 'string') {
                encryptedVal = parsedRes.details;
                keyToUse = 'details';
              } else if (typeof parsedRes.data === 'string') {
                encryptedVal = parsedRes.data;
                keyToUse = 'data';
              }
              if (encryptedVal) {
                const crypto = (window as any).CryptoJS;
                if (crypto) {
                  const secretKey = 'YOTTA2024';
                  const iv = crypto.enc.Hex.parse("101112131415161718191a1b1c1d1e1f");
                  const decryptedBytes = crypto.AES.decrypt(encryptedVal, secretKey, {
                    mode: crypto.mode.CTR,
                    iv: iv
                  });
                  const decryptedText = decryptedBytes.toString(crypto.enc.Utf8);
                  let decryptedObj;
                  try {
                    decryptedObj = JSON.parse(decryptedText);
                  } catch (err) {
                    decryptedObj = decryptedText;
                  }
                  parsedRes[keyToUse] = decryptedObj;
                  res.body = parsedRes;
                  res.obj = parsedRes;
                  res.text = JSON.stringify(parsedRes, null, 2);
                }
              }
            }
          } catch (e) {
            console.error("Swagger response decryption failed:", e);
          }
          return res;
        }
      }
    };

    const envUrl = process.env.BASE_URL || process.env.DEV_URL || process.env.SWAGGER_BASE_URL || DEV_URL;
    const pathPrefix = PATH;
    const serverUrl = envUrl
      ? (envUrl.endsWith('/') ? `${envUrl.slice(0, -1)}${pathPrefix}` : `${envUrl}${pathPrefix}`)
      : pathPrefix;

    (swaggerDocument as any).servers = [
      {
        url: serverUrl,
        description: "Environment Server"
      },
      {
        url: `http://localhost:${PORT}${pathPrefix}`,
        description: "Local Development Server"
      }
    ];

    this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
    if (PATH) {
      this.app.use(`${PATH}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
    }
    this.app.use(express.json({ limit: "100mb" }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      multer({
        limits: {
          fileSize: 50 * 1024 * 1024,
        },
      }).any()
    );

    this.app.use(cors());
    this.app.use(helmet());

    this.app.use((req, res, next): any => {
      if (
        ENABLE_ENCRYPTION &&
        !NON_ENCRYPTION_ENDPOINTS.includes(req.url) &&
        !req.url.includes("/importExcel") &&
        req.method === "POST"
      ) {
        let result = null;

        if (
          req.url.includes("/getall") ||
          req.url.includes("/getdata") ||
          req.url.includes("/getMasterCount")
        ) {
          if (req.body.data !== undefined) {
            result = EncryptionAndDecryption.decryption(req.body.data);
            if (result === StatusCode.INVALID_ENCRYPTED_INPUT) {
              return ApiError.handle(
                new BadRequestError("Invalid Encrypted String"),
                res
              );
            }
            req.body = result;
          }
        } else {
          result = EncryptionAndDecryption.decryption(req.body.data);
          if (result === StatusCode.INVALID_ENCRYPTED_INPUT) {
            return ApiError.handle(
              new BadRequestError("Invalid Encrypted String"),
              res
            );
          }
          req.body = result;
        }
      }

      next();
    });
  }

  private initializeControllers(controllers: BaseController[]) {
    controllers.forEach((controller) => {
      controller.router.stack.forEach((stack: any) => {
        const path: string = PATH + stack.route.path;
        this.pathList.push({
          path: PATH + stack.route.path,
          method: `${stack.route.stack[0].method}`.toLocaleUpperCase(),
        });
      });
      this.app.use(PATH, controller.router);
    });
  }

  private initializeErrorHandling() {
    // Sentry error handler must be before any other error middleware and after all controllers
    Sentry.setupExpressErrorHandler(this.app);

    this.app.use((_req, res, _next): any => {
      for (let val of this.pathList) {
        if (_req.path === val.path && _req.method !== val.method) {
          return ApiError.handle(new MethodNotFoundError(), res);
        }
      }
      return ApiError.handle(new NotFoundError(), res);
    });
  }

  private async initializeKafka() {
    const kafkaService = KafkaService.getInstance();
    await kafkaService.init(kafkaConsumers);
  }

  private initializeWebSocketServerOnSeparatePort() {
    const wsApp = express();
    const wsServer = http.createServer(wsApp);
    wsApp.get("/websocket/infer/api/apiHealthCheck/apihealth", (_req, res) => {
      res.status(200).json({
        message: "WebSocket server healthy",
        ...WebSocketService.getHealthStatus(),
      });
    });
    WebSocketService.init(wsServer, WEBSOCKET_PATH);
    wsServer.listen(WEBSOCKET_PORT, () => {
      console.log(
        `WebSocket server running on port ${WEBSOCKET_PORT} with path ${WEBSOCKET_PATH}`
      );
    });
  }

  public listen() {
    this.server.listen(this.port, () => {
      console.log(`App listening on the port ${this.port}`);
    });
  }
}
