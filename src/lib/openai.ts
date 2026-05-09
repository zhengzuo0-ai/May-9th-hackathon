import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "openai/gpt-5.5";
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: OPENAI_BASE_URL,
    defaultHeaders: OPENAI_BASE_URL?.includes("openrouter.ai")
      ? {
          "HTTP-Referer": "http://127.0.0.1:3000",
          "X-Title": "Concession Recon",
        }
      : undefined,
  });
}

export async function generateText(prompt: string, instructions: string) {
  const response = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  });

  return response.choices[0]?.message.content ?? "";
}

export async function generateJson<T>(prompt: string, instructions: string) {
  const text = await generateText(prompt, instructions);
  return parseJsonFromText<T>(text);
}

export async function streamText(prompt: string, instructions: string) {
  const stream = await getOpenAIClient().chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta.content ?? "";

          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

function parseJsonFromText<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]) as T;
    }

    const match = text.match(/\{[\s\S]*\}/) ?? text.match(/\[[\s\S]*\]/);

    if (!match) {
      throw new Error("Model response did not contain JSON");
    }

    return JSON.parse(match[0]) as T;
  }
}
