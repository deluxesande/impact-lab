import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessageLike } from "@langchain/core/messages";
import type { z } from "zod";

/**
 * Model provider setup and the fallback chain.
 *
 * Providers are initialized only when their key is present, so an absent
 * provider is simply skipped. The fallback order is Gemini → Groq → OpenAI
 * (cheapest/free first, paid last). Each provider is tried in turn; if all
 * configured providers fail, AllModelsFailedError is thrown so the caller can
 * fall back to a non-LLM heuristic.
 */

export type ProviderName = "gemini" | "groq" | "openai";

export class AllModelsFailedError extends Error {
  constructor(public readonly errors: { provider: ProviderName; error: unknown }[]) {
    super(
      `All model providers failed: ${errors.map((e) => `${e.provider}: ${String(e.error)}`).join(" | ")}`,
    );
    this.name = "AllModelsFailedError";
  }
}

interface Provider {
  name: ProviderName;
  model: BaseChatModel;
  /** Vision-capable (accepts image content). */
  vision: boolean;
}

let cachedProviders: Provider[] | undefined;

function buildProviders(): Provider[] {
  if (cachedProviders) return cachedProviders;
  const providers: Provider[] = [];

  if (process.env.GOOGLE_GENAI_API_KEY) {
    providers.push({
      name: "gemini",
      vision: true,
      model: new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
        apiKey: process.env.GOOGLE_GENAI_API_KEY,
        temperature: 0,
        maxRetries: 1,
      }),
    });
  }
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      vision: false,
      model: new ChatGroq({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        apiKey: process.env.GROQ_API_KEY,
        temperature: 0,
        maxRetries: 1,
      }),
    });
  }
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      vision: true,
      model: new ChatOpenAI({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0,
        maxRetries: 1,
      }),
    });
  }

  cachedProviders = providers;
  return providers;
}

/** Whether at least one model provider is configured. */
export function hasModelProvider(): boolean {
  return buildProviders().length > 0;
}

export interface StructuredResult<T> {
  data: T;
  /** Which provider produced the result. */
  provider: ProviderName;
}

/**
 * Invoke the fallback chain, coercing output to a zod schema.
 *
 * @param schema        zod schema the model must satisfy (withStructuredOutput)
 * @param messages      chat messages
 * @param requireVision only consider vision-capable providers
 */
export async function invokeStructured<T>(
  schema: z.ZodType<T>,
  messages: BaseMessageLike[],
  opts: { requireVision?: boolean; runName?: string; tags?: string[] } = {},
): Promise<StructuredResult<T>> {
  const providers = buildProviders().filter((p) => !opts.requireVision || p.vision);
  if (providers.length === 0) {
    throw new AllModelsFailedError([]);
  }

  const errors: { provider: ProviderName; error: unknown }[] = [];
  for (const provider of providers) {
    try {
      const structured = provider.model.withStructuredOutput(schema);
      // runName/tags surface in LangSmith traces when tracing is enabled.
      const data = (await structured.invoke(messages, {
        runName: opts.runName,
        tags: [...(opts.tags ?? []), `provider:${provider.name}`],
      })) as T;
      return { data, provider: provider.name };
    } catch (error) {
      errors.push({ provider: provider.name, error });
    }
  }
  throw new AllModelsFailedError(errors);
}

/** Plain text generation over the fallback chain (for conversational replies). */
export async function invokeText(
  messages: BaseMessageLike[],
  opts: { requireVision?: boolean; runName?: string; tags?: string[] } = {},
): Promise<{ text: string; provider: ProviderName }> {
  const providers = buildProviders().filter((p) => !opts.requireVision || p.vision);
  if (providers.length === 0) throw new AllModelsFailedError([]);

  const errors: { provider: ProviderName; error: unknown }[] = [];
  for (const provider of providers) {
    try {
      const res = await provider.model.invoke(messages, {
        runName: opts.runName,
        tags: [...(opts.tags ?? []), `provider:${provider.name}`],
      });
      const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
      return { text, provider: provider.name };
    } catch (error) {
      errors.push({ provider: provider.name, error });
    }
  }
  throw new AllModelsFailedError(errors);
}
