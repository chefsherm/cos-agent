import Anthropic from "@anthropic-ai/sdk";

// Model for both CC AI functions, per the project brief.
export const CC_MODEL = "claude-sonnet-4-6";

let client = globalThis.__ccAnthropic;

export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    globalThis.__ccAnthropic = client;
  }
  return client;
}

// Pulls the first JSON object/array out of a model response, tolerating any
// prose or code-fencing around it. Returns null if nothing parses.
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end--) {
    const slice = candidate.slice(start, end);
    try {
      return JSON.parse(slice);
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}
