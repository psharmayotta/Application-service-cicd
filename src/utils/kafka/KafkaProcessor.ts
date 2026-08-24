import { Message } from "node-rdkafka";
import { ModuleType } from "../../config";
import { KafkaMessage } from "./kafkaMassege.interface";

export class KafkaProcessor {
  public static async process(msg: Message): Promise<void> {
    try {
      const value = msg.value?.toString();
      if (!value) {
        return;
      }

      const parsed: KafkaMessage = JSON.parse(value);

      switch (parsed.module) {
        case ModuleType.MYMODEL:
          break;
        case ModuleType.TRAINING:
          break;
        case ModuleType.DEPLOYMENT:
          
          break;
        default:
          console.warn(`Unknown module type: ${parsed.module}`);
      }
    } catch (err) {
      console.error("Error processing Kafka message:", err);
    }
  }
}
