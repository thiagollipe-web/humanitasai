const MODEL = process.env.OLLAMA_MODEL || "gemma4:31b";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const key = process.env.OLLAMA_API_KEY;
  if (!key) return res.status(500).json({ error: "OLLAMA_API_KEY não configurada na Vercel." });

  try {
    const body = req.body || {};
    const question = String(body.question || "").trim();
    if (!question) return res.status(400).json({ error: "Pergunta vazia." });

    const refs = Array.isArray(body.references) ? body.references.slice(0, 16) : [];
    const history = Array.isArray(body.history)
      ? body.history.filter(function (m) {
          return m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
        }).slice(-10)
      : [];

    const context = refs.map(function (r) {
      return "[" + r.n + "] " + r.source + " — " + r.title +
        "\nTipo: " + r.type +
        "\nDescrição: " + (r.description || "Sem descrição") +
        "\nURL: " + (r.url || "");
    }).join("\n\n");

    const systemInstruction =
      "Você é o Humanitas, um assistente de pesquisa em Ciências Humanas. " +
      "Responda em português do Brasil, com clareza e rigor. " +
      "Use as referências fornecidas como base documental. " +
      "Não invente referências, autores, DOI, páginas ou fatos que não estejam sustentados pelo contexto. " +
      "Quando uma afirmação estiver apoiada por uma referência, indique [n] usando o número fornecido. " +
      "Se as referências não forem suficientes, diga isso explicitamente. " +
      "Diferencie fatos documentados, interpretação acadêmica e incerteza. " +
      "Não apresente sua própria resposta como fonte acadêmica.";

    const messages = [{ role: "system", content: systemInstruction }];
    history.forEach(function (m) {
      messages.push({ role: m.role, content: m.content });
    });

    messages.push({
      role: "user",
      content:
        "REFERÊNCIAS DO HUMANITAS:\n\n" +
        (context || "Nenhuma referência disponível.") +
        "\n\nPERGUNTA DO USUÁRIO:\n" + question
    });

    const response = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || "Erro na API Ollama."
      });
    }

    const answer = data.message?.content || "";
    return res.status(200).json({
      answer,
      model: data.model || MODEL
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno ao consultar o Ollama." });
  }
}