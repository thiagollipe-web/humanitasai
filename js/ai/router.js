import { loadModel } from "./model.js";

const SYSTEM_PROMPT = `Você é o roteador local do Humanitas.
Sua única função é classificar o comando do usuário.
Responda SOMENTE com JSON válido:
{"intent":"SEARCH|OPEN|NAVIGATE|FILTER|HELP|UNKNOWN","action":"SEARCH","query":"string","confidence":0.0}
Não responda à pergunta. Não invente informações. Não execute ações.
Para uma pesquisa acadêmica, use intent SEARCH e coloque somente o assunto pesquisado em query.`;

const ALLOWED = new Set(["SEARCH", "OPEN", "NAVIGATE", "FILTER", "HELP", "UNKNOWN"]);

function fallback() {
  return { intent: "UNKNOWN", action: "", query: "", confidence: 0 };
}

function extractText(output) {
  const generated = output?.[0]?.generated_text;
  if (Array.isArray(generated)) {
    const last = generated.at(-1);
    return typeof last === "string" ? last : String(last?.content || "");
  }
  return String(generated || "");
}

function parseRouterJson(raw) {
  const match = raw.match(/\{[\s\S]*?\}/);
  if (!match) return fallback();

  try {
    const x = JSON.parse(match[0]);
    const confidence = Number(x.confidence);
    return {
      intent: ALLOWED.has(x.intent) ? x.intent : "UNKNOWN",
      action: String(x.action || ""),
      query: String(x.query || "").trim(),
      confidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : 0
    };
  } catch {
    return fallback();
  }
}

export async function routeCommand(text, onProgress = () => {}) {
  const input = String(text || "").trim();
  if (!input) return fallback();

  const model = await loadModel(onProgress);
  const output = await model([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: input }
  ], {
    max_new_tokens: 80,
    do_sample: false
  });

  return parseRouterJson(extractText(output));
}
