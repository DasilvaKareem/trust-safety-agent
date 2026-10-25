import { defineAgent } from "eve";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Orchestrator model: Gemini 3.8 Flash (direct Google provider, no AI Gateway).
// It only decides which tool to call; the actual verdicts come from the deep_scan
// workflow (Flash -> Argon with heavy thinking).
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export default defineAgent({
  model: google(process.env.GEMINI_FAST_MODEL || "gemini-3.8-flash"),
  modelOptions: {
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
  },
});
