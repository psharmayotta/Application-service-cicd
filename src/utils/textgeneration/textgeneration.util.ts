type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function formatLlamaChat(messages: ChatMessage[]): string {
  // Special tokens for LLaMA-style chat formatting
  const BOS = "<|begin_of_text|>";
  const SOH = "<|start_header_id|>";
  const EOH = "<|end_header_id|>";
  const EOT = "<|eot_id|>";
  const ASSISTANT_ROLE = "assistant";

  const out: string[] = [];
  let i = 0;

  // Handle system message if present
  if (messages.length > 0 && messages[0].role === "system") {
    const sysMsg = messages[0].content.trim();
    out.push(`${BOS}${SOH}system${EOH}\n\n${sysMsg}${EOT}`);
    i = 1;
  } else {
    out.push(BOS);
  }

  // Iterate through user + assistant message pairs
  while (i < messages.length) {
    const m = messages[i];

    if (m.role === "user") {
      const userTxt = m.content.trim();
      out.push(`${SOH}user${EOH}\n\n${userTxt}${EOT}`);

      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        const asstTxt = messages[i + 1].content.trim();
        out.push(`${SOH}${ASSISTANT_ROLE}${EOH}\n\n${asstTxt}${EOT}`);
        i += 2;
      } else {
        // Open assistant header for model to generate completion
        out.push(`${SOH}${ASSISTANT_ROLE}${EOH}\n\n`);
        i += 1;
        break;
      }
    } else {
      i += 1; // Skip non-user messages
    }
  }

  return out.join("");
}

export function extractLastAssistantReply(textOutput: string): any {
  const marker = "<|start_header_id|>assistant<|end_header_id|>";
  const parts = textOutput.split(marker);

  if (parts.length < 2) {
    return textOutput; // Fallback: no assistant marker found
  }

  // Take last assistant block, remove <|eot_id|>, and trim
  const lastBlock = parts[parts.length - 1];
  return { "text_output": lastBlock.replace(/<\|eot_id\|>/g, "").trim() };
}


type ChatMessageMistral = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function formatMistralChat(messages: ChatMessage[]): string {
  let out: string[] = [];

  // Handle system message if present
  if (messages.length > 0 && messages[0].role === "system") {
    const sysMsg = messages[0].content.trim();
    out.push(`<s>[INST] <<SYS>>\n${sysMsg}\n<</SYS>>\n`);
    messages = messages.slice(1);
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === "user") {
      const userTxt = m.content.trim();
      // Open user instruction
      out.push(`${userTxt} [/INST]`);

      // If assistant follows, include it inline
      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        const asstTxt = messages[i + 1].content.trim();
        out.push(` ${asstTxt} </s>\n<s>[INST]`);
        i++; // skip assistant (already handled)
      } else {
        // Leave open for model to generate assistant response
        out.push(" ");
      }
    }
  }

  return out.join("");
}


type ChatMessageOss = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function formatOssChat(messages: ChatMessageOss[]): string {
  const out: string[] = [];

  // Handle system message first
  if (messages.length > 0 && messages[0].role === "system") {
    out.push(
      `<|start|>system<|message|>${messages[0].content.trim()}<|end|>`
    );
    messages = messages.slice(1);
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === "user") {
      out.push(`<|start|>user<|message|>${m.content.trim()}<|end|>`);

      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        const asstTxt = messages[i + 1].content.trim();
        out.push(
          `<|start|>assistant<|channel|>final<|message|>${asstTxt}<|end|>`
        );
        i++;
      } else {
        // Leave open for assistant to generate
        out.push(`<|start|>assistant`);
      }
    }
  }

  return out.join("");
}




