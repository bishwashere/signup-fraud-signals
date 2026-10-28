// Optional Workers AI second opinion. This never blocks or fails a request:
// if the binding is missing or the call errors, scoring falls back to the
// heuristic layer alone.

export interface AiEnv {
  AI?: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
}

export async function aiSecondOpinion(
  email: string,
  env: AiEnv
): Promise<{ suspicious: boolean; note: string } | null> {
  try {
    if (!env.AI) return null;
    const local = email.split("@")[0] ?? email;
    const prompt =
      "You are a fraud analyst. Is this signup email local-part likely " +
      "auto-generated or abusive? Reply with exactly one word: YES or NO. " +
      `Local-part: ${local}`;
    const res = (await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      prompt,
      max_tokens: 8,
    })) as { response?: string };
    const text = String(res?.response ?? "").toUpperCase();
    if (text.includes("YES")) {
      return {
        suspicious: true,
        note: "Workers AI flagged the email pattern as likely auto-generated",
      };
    }
    return { suspicious: false, note: "" };
  } catch {
    return null;
  }
}
