
import {
  KafkaConsumer,
  Producer,
  Message,
  LibrdKafkaError,
} from "node-rdkafka";
import { BOOTSTRAP, MECHANISMS, USERNAME, PASSWORD, GROUP_ID } from "../../config";
import Database from "../../database/database";
import { enrichWithReservationStatus } from "../reservationCheck";

type MessageHandler = (msg: Message) => Promise<void> | void;

interface TopicHandler {
  topic: string;
  handler: MessageHandler;
}

export class KafkaService {
  private static instance: KafkaService;

  private consumer: KafkaConsumer | null = null;
  private producer: Producer | null = null;
  private isProducerReady: boolean = false;
  private topicHandlers: Map<string, MessageHandler> = new Map();
  private enterpriseStatusCache: Map<number, boolean> = new Map();

  private constructor() { }

  public static getInstance(): KafkaService {
    if (!KafkaService.instance) {
      KafkaService.instance = new KafkaService();
    }
    return KafkaService.instance;
  }

  // ================================
  // 👇 Init Kafka (Producer + Consumer)
  // ================================
  public async init(topicsToConsume: TopicHandler[]): Promise<void> {
    console.log("🚀 Initializing Kafka Service...");
    try {
      await Promise.all([
        this.connectProducer(),
        this.connectConsumer(topicsToConsume),
      ]);
      console.log("✨ Kafka Service fully initialized");
    } catch (err) {
      console.error("💥 Kafka Service initialization failed:", err);
      throw err;
    }
  }


  // ================================
  // 👇 Producer
  // ================================
  private connectProducer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.producer = new Producer({
        "metadata.broker.list": BOOTSTRAP,
        "security.protocol": "sasl_plaintext",
        "sasl.mechanisms": MECHANISMS,
        "sasl.username": USERNAME,
        "sasl.password": PASSWORD,
        "queue.buffering.max.messages": 100000,
        "queue.buffering.max.ms": 5,
        dr_cb: true,
      });

      this.producer.on("ready", () => {
        console.log("✅ Kafka Producer connected");
        this.isProducerReady = true;
        this.producer?.setPollInterval(100);
        resolve();
      });

      this.producer.on("event.error", (err) => {
        console.error("❌ Kafka Producer error:", err);
        reject(err);
      });

      console.log(`📡 Connecting Kafka Producer to ${BOOTSTRAP}...`);
      this.producer.connect();

      // Fallback timeout for connect if it hangs
      setTimeout(() => {
        if (!this.isProducerReady) {
          console.warn("⏳ Kafka Producer connection is taking longer than expected...");
        }
      }, 5000);
    });
  }

  public async sendMessage(topic: string, message: any, retries = 3): Promise<void> {
    const targetId = message?.company_id || message?.org_id;
    if (message && typeof message === 'object' && targetId && message.is_enterprise === undefined) {
      message.is_enterprise = await this.getCompanyEnterpriseStatus(targetId);
    }

    // Enrich message with reservation status (is_reserved, reservation_id)
    if (message && typeof message === 'object') {
      message = await enrichWithReservationStatus(message);
    }

    if (!this.producer || !this.isProducerReady) {
      console.warn(`⚠️ Kafka Producer not ready, cannot send message to [${topic}]. Retrying in 1s...`);
      if (retries > 0) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.sendMessage(topic, message, retries - 1).then(resolve).catch(reject);
          }, 1000);
        });
      }
      throw new Error(`Kafka Producer not ready after retries. Failed to send message to [${topic}]`);
    }

    return new Promise((resolve, reject) => {
      try {
        const buffer = Buffer.from(JSON.stringify(message));
        this.producer?.produce(topic, null, buffer, null, Date.now());
        console.log(`📤 Sent to [${topic}]:`, message);
        resolve();
      } catch (err: any) {
        if (err.code === -184 && retries > 0) {
          console.warn(`⚠️ Queue full, retrying in 500ms... (${retries} retries left)`);
          setTimeout(() => {
            this.sendMessage(topic, message, retries - 1).then(resolve).catch(reject);
          }, 500);
        } else {
          console.error("❌ Error sending Kafka message:", err);
          reject(err);
        }
      }
    });
  }

  private async getCompanyEnterpriseStatus(companyId: number): Promise<boolean> {
    if (this.enterpriseStatusCache.has(companyId)) {
      return this.enterpriseStatusCache.get(companyId)!;
    }
    try {
      const db = Database.getInstance();
      if (!db["postgresConnection"]) {
         return false;
      }
      const result = await db["postgresConnection"].query(
        'SELECT is_enterprise FROM v0_dev_yotta.company WHERE id = $1',
        [companyId]
      );
      const status = result && result.length > 0 ? result[0].is_enterprise : false;
      this.enterpriseStatusCache.set(companyId, status);
      return status;
    } catch (err) {
      console.error(`Error fetching enterprise status for company ${companyId}:`, err);
      return false;
    }
  }

  // ================================
  // 👇 Consumer
  // ================================
  private connectConsumer(topicsToConsume: TopicHandler[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.consumer = new KafkaConsumer(
        {
          "bootstrap.servers": BOOTSTRAP,
          "security.protocol": "sasl_plaintext",
          "sasl.mechanisms": MECHANISMS,
          "sasl.username": USERNAME,
          "sasl.password": PASSWORD,
          "group.id": GROUP_ID,
          "enable.auto.commit": false,
          "auto.offset.reset": "latest", // only used when the group has no committed offsets
          "metadata.request.timeout.ms": 30000,
          "socket.keepalive.enable": true,
        } as any,
        {}
      );

      this.consumer.on("ready", () => {
        const topics = topicsToConsume.map((t) => t.topic);

        topicsToConsume.forEach((t) => {
          this.topicHandlers.set(t.topic, t.handler);
        });

        this.consumer.subscribe(topics);
        this.consumer.consume();

        console.log(
          `📥 Subscribed to consumer group topics: ${topics.join(", ")}`
        );
        resolve();
      });

      this.consumer.on("data", async (msg: Message) => {
        const handler = this.topicHandlers.get(msg.topic);
        const value = msg.value?.toString();

        try {
          if (handler) {
            await handler(msg);
          } else {
            console.log(
              `📩 [${msg.topic}] ${msg.partition}@${msg.offset} -> ${value}`
            );
          }

          this.consumer.commitMessage(msg);
        } catch (err) {
          console.error(
            `❌ Kafka handler failed for [${msg.topic}] ${msg.partition}@${msg.offset}:`,
            err
          );
        }
      });

      this.consumer.on("event.error", (err: LibrdKafkaError) => {
        console.error("❌ Kafka consumer error:", err);
      });

      this.consumer.connect();
    });
  }

  // ================================
  // 👇 Graceful Shutdown
  // ================================
  public shutdown() {
    console.log("🔌 Shutting down Kafka service...");
    if (this.consumer) this.consumer.disconnect();
    if (this.producer) this.producer.disconnect();
  }
}
