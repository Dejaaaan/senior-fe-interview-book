import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const runtime = "edge";

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    messages,
    system:
      "You are a concise senior frontend engineer. Answer in 2-3 sentences with a code example only when asked.",
  });

  return result.toDataStreamResponse();
}
