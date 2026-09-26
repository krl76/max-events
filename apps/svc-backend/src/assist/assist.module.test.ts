import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_API_MODELS, DEFAULT_MODEL_API_URL } from "../config/env";
import { createLlmProvider } from "./assist.module";
import { ModelApiLlmProvider } from "./model-api-llm.provider";
import { NoneLlmProvider } from "./none-llm.provider";

describe("createLlmProvider", () => {
  it("stays disabled without a key and calls the model API when a key is set", () => {
    expect(createLlmProvider(undefined, DEFAULT_MODEL_API_URL, DEFAULT_MODEL_API_MODELS)).toBeInstanceOf(NoneLlmProvider);
    expect(createLlmProvider("replace-with-your-model-api-key", DEFAULT_MODEL_API_URL, ["", "mimo-v2.6-flash-free"])).toBeInstanceOf(ModelApiLlmProvider);
    expect(createLlmProvider("replace-with-your-model-api-key", DEFAULT_MODEL_API_URL, [])).toBeInstanceOf(NoneLlmProvider);
  });
});
