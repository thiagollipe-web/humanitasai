import { loadModel } from "./model.js";

const SYSTEM_PROMPT = `Você é o roteador local do Humanitas.
Identifique somente a intenção do usuário.
Responda SOMENTE JSON válido:
{"intent":"SEARCH|OPEN|NAVIGATE|FILTER|HELP|UNKNOWN","action":"string","query":"string","confidence":0.0}
Não converse, não invente informações e não execute ações.`;

const ALLOWED = new Set(["SEARCH","OPEN","NAVIGATE","FILTER","HELP","UNKNOWN"]);

export async function routeCommand(text, onProgress) {
  const model = await loadModel(onProgress);
  const output = await model([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: text }
  ], { max_new_tokens: 80, do_sample: false, temperature: 0 });

  const generated = output?.[0]?.generated_text;
  const raw = Array.isArray(generated)
    ? generated.at(-1)?.content || ""
    : String(generated || "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { intent:"UNKNOWN", action:"", query:"", confidence:0 };

  try {
    const x = JSON.parse(match[0]);
    return {
      intent: ALLOWED.has(x.intent) ? x.intent : "UNKNOWN",
      action: String(x.action || ""),
      query: String(x.query || ""),
      confidence: Math.max(0, Math.min(1, Number(x.confidence) || 0))
    };
  } catch {
    return { intent:"UNKNOWN", action:"", query:"", confidence:0 };
  }
}
