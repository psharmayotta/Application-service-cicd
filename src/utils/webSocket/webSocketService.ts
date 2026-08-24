import http from "http";
import { createClient } from "redis";
import WebSocket, { WebSocketServer } from "ws";
import {
  WEBSOCKET_HEARTBEAT_INTERVAL_MS,
  WEBSOCKET_PATH,
  WEBSOCKET_REDIS_CHANNEL,
  WEBSOCKET_REDIS_URL,
} from "../../config";
import { CompanyMemberRolesEntity } from "../../entities/companyMemberRolesEntity";
import { verifyjwtStrict } from "../jwt/jwt";

interface WebSocketAuthClaims {
  member_id?: number;
  company_id?: number | string;
  email?: string;
  role_id?: number;
  exp?: number;
  iat?: number;
}

type TrackedWebSocket = WebSocket & {
  isAlive?: boolean;
  companyID?: string;
  memberID?: number;
};

interface DistributedWebSocketMessage {
  companyID: string;
  message: unknown;
  timestamp: string;
}

interface WebSocketMetrics {
  acceptedConnections: number;
  rejectedAuthAttempts: number;
  staleSocketsTerminated: number;
  pubSubPublishFailures: number;
  pubSubConsumeFailures: number;
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private static wss: WebSocketServer | null = null;
  private static groups: Map<string, Set<TrackedWebSocket>> = new Map();
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static redisPublisher: any = null;
  private static redisSubscriber: any = null;
  private static redisReady = false;
  private static redisInitPromise: Promise<void> | null = null;
  private static metrics: WebSocketMetrics = {
    acceptedConnections: 0,
    rejectedAuthAttempts: 0,
    staleSocketsTerminated: 0,
    pubSubPublishFailures: 0,
    pubSubConsumeFailures: 0,
  };

  private constructor(server: http.Server, path = WEBSOCKET_PATH) {
    if (!server) {
      throw new Error("HTTP server is required for WebSocketService");
    }

    if (!WebSocketService.wss) {
      WebSocketService.wss = new WebSocketServer({ server, path });
      this.setupWebSocketListeners(path);
      this.startHeartbeat();
      void WebSocketService.initializeRedisPubSub();
      server.on("close", () => {
        void WebSocketService.shutdown();
      });
    }
  }

  public static getInstance(
    server: http.Server,
    path = WEBSOCKET_PATH
  ): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(server, path);
    }
    return WebSocketService.instance;
  }

  private setupWebSocketListeners(path: string) {
    if (!WebSocketService.wss) {
      return;
    }

    WebSocketService.wss.on("connection", (ws: WebSocket, req) => {
      void this.handleConnection(ws as TrackedWebSocket, req);
    });

    console.log(`WebSocket listening at path: ${path}`);
  }

  private async handleConnection(ws: TrackedWebSocket, req: http.IncomingMessage) {
    const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const requestedCompanyID = WebSocketService.normalizeCompanyID(
      url.searchParams.get("companyID")
    );

    try {
      const token = WebSocketService.extractToken(req, url);
      if (!token) {
        WebSocketService.metrics.rejectedAuthAttempts += 1;
        console.warn(
          `Rejected WebSocket connection from ${req.socket.remoteAddress}: missing token`
        );
        return WebSocketService.rejectSocket(
          ws,
          1008,
          "Authentication token is required"
        );
      }

      const claims = verifyjwtStrict(token) as WebSocketAuthClaims;
      const companyID = await WebSocketService.resolveAuthorizedCompanyID(
        claims,
        requestedCompanyID
      );

      if (!companyID) {
        WebSocketService.metrics.rejectedAuthAttempts += 1;
        console.warn(
          `Rejected WebSocket connection for member ${claims.member_id || "unknown"}: unauthorized company access`
        );
        return WebSocketService.rejectSocket(
          ws,
          1008,
          "Unauthorized company subscription"
        );
      }

      ws.isAlive = true;
      ws.companyID = companyID;
      ws.memberID = claims.member_id;

      if (!WebSocketService.groups.has(companyID)) {
        WebSocketService.groups.set(companyID, new Set());
      }
      WebSocketService.groups.get(companyID)!.add(ws);
      WebSocketService.metrics.acceptedConnections += 1;

      console.log(
        `Accepted WebSocket connection from ${req.socket.remoteAddress} for company ${companyID} member ${claims.member_id || "unknown"}`
      );

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", () => {
        WebSocketService.sendJson(ws, {
          type: "error",
          timestamp: new Date().toISOString(),
          error: {
            code: "UNSUPPORTED_CLIENT_MESSAGE",
            message: "Client-initiated WebSocket messages are not supported.",
          },
        });
      });

      ws.on("close", (code, reason) => {
        WebSocketService.cleanupSocket(
          ws,
          `close:${code}:${reason.toString() || "no-reason"}`
        );
      });

      ws.on("error", (error) => {
        console.error(
          `WebSocket error for company ${companyID} member ${claims.member_id || "unknown"}:`,
          error
        );
        WebSocketService.cleanupSocket(ws, "error");
      });

      WebSocketService.sendJson(ws, {
        type: "welcome",
        companyID,
        timestamp: new Date().toISOString(),
        data: {
          message: "Connected to WebSocket server",
        },
      });
    } catch (error) {
      WebSocketService.metrics.rejectedAuthAttempts += 1;
      console.error(
        `Rejected WebSocket connection from ${req.socket.remoteAddress}:`,
        error
      );
      WebSocketService.rejectSocket(ws, 1008, "Invalid or expired token");
    }
  }

  private startHeartbeat() {
    if (WebSocketService.heartbeatInterval || !WebSocketService.wss) {
      return;
    }

    WebSocketService.heartbeatInterval = setInterval(() => {
      WebSocketService.wss?.clients.forEach((client) => {
        const trackedClient = client as TrackedWebSocket;

        if (trackedClient.isAlive === false) {
          WebSocketService.metrics.staleSocketsTerminated += 1;
          console.warn(
            `Terminating stale WebSocket connection for company ${trackedClient.companyID || "unknown"}`
          );
          WebSocketService.cleanupSocket(trackedClient, "heartbeat-timeout");
          trackedClient.terminate();
          return;
        }

        trackedClient.isAlive = false;
        try {
          trackedClient.ping();
        } catch (error) {
          console.error("Failed to ping WebSocket client:", error);
          WebSocketService.cleanupSocket(trackedClient, "ping-failure");
          trackedClient.terminate();
        }
      });
    }, WEBSOCKET_HEARTBEAT_INTERVAL_MS);
  }

  private static async initializeRedisPubSub(): Promise<void> {
    if (WebSocketService.redisInitPromise) {
      return WebSocketService.redisInitPromise;
    }

    if (!WEBSOCKET_REDIS_URL) {
      console.warn(
        "WEBSOCKET_REDIS_URL is not configured. WebSocket delivery will stay local to this pod."
      );
      return;
    }

    WebSocketService.redisInitPromise = (async () => {
      const publisher = createClient({ url: WEBSOCKET_REDIS_URL });
      const subscriber = publisher.duplicate();

      publisher.on("error", (error: unknown) => {
        console.error("WebSocket Redis publisher error:", error);
        void WebSocketService.resetRedisPubSub();
      });

      subscriber.on("error", (error: unknown) => {
        WebSocketService.metrics.pubSubConsumeFailures += 1;
        console.error("WebSocket Redis subscriber error:", error);
        void WebSocketService.resetRedisPubSub();
      });

      try {
        await Promise.all([publisher.connect(), subscriber.connect()]);
        await subscriber.subscribe(
          WEBSOCKET_REDIS_CHANNEL,
          async (rawMessage: string) => {
            try {
              const payload = JSON.parse(
                rawMessage
              ) as DistributedWebSocketMessage;

              if (!payload.companyID) {
                throw new Error("Missing companyID in pub/sub payload");
              }

              WebSocketService.deliverToLocalCompany(
                payload.companyID,
                payload.message,
                payload.timestamp
              );
            } catch (error) {
              WebSocketService.metrics.pubSubConsumeFailures += 1;
              console.error("Failed to process Redis WebSocket payload:", error);
            }
          }
        );

        WebSocketService.redisPublisher = publisher;
        WebSocketService.redisSubscriber = subscriber;
        WebSocketService.redisReady = true;
        console.log(
          `WebSocket Redis pub/sub connected on channel ${WEBSOCKET_REDIS_CHANNEL}`
        );
      } catch (error) {
        WebSocketService.redisReady = false;
        WebSocketService.metrics.pubSubPublishFailures += 1;
        console.error("Failed to initialize WebSocket Redis pub/sub:", error);

        try {
          await subscriber.disconnect();
        } catch {
          // Ignore disconnect cleanup errors during failed startup.
        }

        try {
          await publisher.disconnect();
        } catch {
          // Ignore disconnect cleanup errors during failed startup.
        }
      } finally {
        WebSocketService.redisInitPromise = null;
      }
    })();

    return WebSocketService.redisInitPromise;
  }

  public static init(server: http.Server, path = WEBSOCKET_PATH) {
    if (!WebSocketService.instance) {
      WebSocketService.getInstance(server, path);
    }
  }

  public static async pushMessageToCompany(
    companyID: string,
    message: unknown
  ): Promise<void> {
    const normalizedCompanyID = WebSocketService.normalizeCompanyID(companyID);
    if (!normalizedCompanyID) {
      console.warn("Skipping WebSocket push because companyID is missing.");
      return;
    }

    const payload: DistributedWebSocketMessage = {
      companyID: normalizedCompanyID,
      message,
      timestamp: new Date().toISOString(),
    };

    if (
      WEBSOCKET_REDIS_URL &&
      !WebSocketService.redisReady &&
      !WebSocketService.redisInitPromise
    ) {
      await WebSocketService.initializeRedisPubSub();
    }

    if (WebSocketService.redisReady && WebSocketService.redisPublisher) {
      try {
        await WebSocketService.redisPublisher.publish(
          WEBSOCKET_REDIS_CHANNEL,
          JSON.stringify(payload)
        );
        return;
      } catch (error) {
        WebSocketService.metrics.pubSubPublishFailures += 1;
        console.error("Failed to publish WebSocket message to Redis:", error);
        await WebSocketService.resetRedisPubSub();
      }
    }

    WebSocketService.deliverToLocalCompany(
      normalizedCompanyID,
      message,
      payload.timestamp
    );
  }

  public static broadcast(data: unknown) {
    if (!WebSocketService.wss) {
      return;
    }

    WebSocketService.wss.clients.forEach((client) => {
      const trackedClient = client as TrackedWebSocket;
      if (trackedClient.readyState !== WebSocket.OPEN) {
        WebSocketService.cleanupSocket(trackedClient, "broadcast-not-open");
        return;
      }

      WebSocketService.sendJson(trackedClient, data);
    });
  }

  public static getHealthStatus() {
    return {
      status:
        WEBSOCKET_REDIS_URL && !WebSocketService.redisReady ? "degraded" : "ok",
      activeConnections: WebSocketService.getActiveConnectionCount(),
      connectionsPerCompany: WebSocketService.getConnectionsPerCompany(),
      acceptedConnections: WebSocketService.metrics.acceptedConnections,
      rejectedAuthAttempts: WebSocketService.metrics.rejectedAuthAttempts,
      staleSocketsTerminated: WebSocketService.metrics.staleSocketsTerminated,
      redis: {
        enabled: Boolean(WEBSOCKET_REDIS_URL),
        ready: WebSocketService.redisReady,
        channel: WEBSOCKET_REDIS_CHANNEL,
        publishFailures: WebSocketService.metrics.pubSubPublishFailures,
        consumeFailures: WebSocketService.metrics.pubSubConsumeFailures,
      },
    };
  }

  public static async shutdown(): Promise<void> {
    if (WebSocketService.heartbeatInterval) {
      clearInterval(WebSocketService.heartbeatInterval);
      WebSocketService.heartbeatInterval = null;
    }

    await WebSocketService.resetRedisPubSub();
  }

  private static async resetRedisPubSub(): Promise<void> {
    WebSocketService.redisReady = false;

    if (WebSocketService.redisSubscriber) {
      try {
        await WebSocketService.redisSubscriber.disconnect();
      } catch (error) {
        console.error("Failed to disconnect WebSocket Redis subscriber:", error);
      } finally {
        WebSocketService.redisSubscriber = null;
      }
    }

    if (WebSocketService.redisPublisher) {
      try {
        await WebSocketService.redisPublisher.disconnect();
      } catch (error) {
        console.error("Failed to disconnect WebSocket Redis publisher:", error);
      } finally {
        WebSocketService.redisPublisher = null;
      }
    }
  }

  private static deliverToLocalCompany(
    companyID: string,
    message: unknown,
    timestamp = new Date().toISOString()
  ) {
    const clients = WebSocketService.groups.get(companyID);
    if (!clients || clients.size === 0) {
      return;
    }

    const payload = {
      type: "update",
      companyID,
      timestamp,
      data: message,
    };

    clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        WebSocketService.cleanupSocket(client, "send-not-open");
        return;
      }

      WebSocketService.sendJson(client, payload);
    });
  }

  private static sendJson(ws: TrackedWebSocket, payload: unknown) {
    let serializedPayload: string;

    try {
      serializedPayload = JSON.stringify(payload);
    } catch (error) {
      console.error("Failed to serialize WebSocket payload:", error);
      WebSocketService.cleanupSocket(ws, "serialization-failure");
      return;
    }

    ws.send(serializedPayload, (error) => {
      if (error) {
        console.error(
          `Failed to send WebSocket payload for company ${ws.companyID || "unknown"}:`,
          error
        );
        WebSocketService.cleanupSocket(ws, "send-failure");
      }
    });
  }

  private static cleanupSocket(ws: TrackedWebSocket, reason: string) {
    const companyID = ws.companyID;
    if (!companyID) {
      return;
    }

    const clients = WebSocketService.groups.get(companyID);
    if (!clients) {
      ws.companyID = undefined;
      return;
    }

    const removed = clients.delete(ws);
    if (removed) {
      console.log(
        `Cleaned up WebSocket connection for company ${companyID} member ${ws.memberID || "unknown"} (${reason})`
      );
    }

    if (clients.size === 0) {
      WebSocketService.groups.delete(companyID);
    }

    ws.companyID = undefined;
  }

  private static rejectSocket(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason.slice(0, 123));
    } catch (error) {
      console.error("Failed to close rejected WebSocket connection:", error);
      try {
        ws.terminate();
      } catch {
        // Ignore terminate failures while rejecting the socket.
      }
    }
  }

  private static normalizeCompanyID(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalizedValue = String(value).trim();
    return normalizedValue ? normalizedValue : null;
  }

  private static extractToken(
    req: http.IncomingMessage,
    url: URL
  ): string | null {
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      return queryToken;
    }

    const authorizationHeader = req.headers.authorization;
    if (
      typeof authorizationHeader === "string" &&
      authorizationHeader.startsWith("Bearer ")
    ) {
      return authorizationHeader.slice("Bearer ".length).trim();
    }

    return null;
  }

  private static async resolveAuthorizedCompanyID(
    claims: WebSocketAuthClaims,
    requestedCompanyID: string | null
  ): Promise<string | null> {
    const tokenCompanyID = WebSocketService.normalizeCompanyID(claims.company_id);
    if (!requestedCompanyID) {
      return tokenCompanyID;
    }

    if (tokenCompanyID && tokenCompanyID === requestedCompanyID) {
      return tokenCompanyID;
    }

    if (!claims.member_id) {
      return null;
    }

    const membership = await CompanyMemberRolesEntity.findOne({
      where: {
        member_id: claims.member_id,
        company_id: Number(requestedCompanyID),
        active: true,
        is_access_active: true,
        is_delete: 0,
      },
    });

    return membership ? requestedCompanyID : null;
  }

  private static getActiveConnectionCount(): number {
    let activeConnections = 0;

    WebSocketService.groups.forEach((clients) => {
      activeConnections += clients.size;
    });

    return activeConnections;
  }

  private static getConnectionsPerCompany(): Record<string, number> {
    const connectionsPerCompany: Record<string, number> = {};

    WebSocketService.groups.forEach((clients, companyID) => {
      connectionsPerCompany[companyID] = clients.size;
    });

    return connectionsPerCompany;
  }
}
