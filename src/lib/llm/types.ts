export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionRequest = {
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
};

export type ChatCompletionResponse = {
  content: string;
  mock: boolean;
};
