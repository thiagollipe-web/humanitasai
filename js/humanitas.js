const $ = (s) => document.querySelector(s);
const status = $("#status");
const analysis = $("#analysis");
const results = $("#results");
const aiButton = $("#aiButton");
const aiState = $("#aiState");

const esc = (x) => String(x ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ""), location.href);
    return url.protocol === "https:" ? url.href : "#";
  } catch {
    return "#";
  }
};

async function json(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function wiki(q) {
  const d = await json(`https://pt.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=6`);
  return (d.pages || []).map(x => ({
    source: "Wikimedia",
    type: "Enciclopédia",
    title: x.title || x.key || "Sem título",
    description: x.description || "",
    url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(x.key || x.title || "")}`
  }));
}

async function wikidata(q) {
  const d = await json(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=pt&uselang=pt&format=json&limit=6&origin=*`);
  return (d.search || []).map(x => ({
    source: "Wikidata",
    type: "Dados estruturados",
    title: x.label || x.id || "Sem título",
    description: x.description || "",
    url: `https://www.wikidata.org/wiki/${encodeURIComponent(x.id || "")}`
  }));
}

async function openalex(q) {
  const d = await json(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=8`);
  return (d.results || []).map(x => ({
    source: "OpenAlex",
    type: "Literatura acadêmica",
    title: x.title || "Sem título",
    description: `${x.publication_year || "Ano não informado"} • ${x.cited_by_count || 0} citações`,
    url: safeUrl(x.doi || x.id),
    doi: x.doi || "",
    citations: Number(x.cited_by_count) || 0
  }));
}

async function crossref(q) {
  const d = await json(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=6`);
  return (d.message?.items || []).map(x => {
    const doi = x.DOI || "";
    return {
      source: "Crossref",
      type: "Metadado bibliográfico",
      title: x.title?.[0] || "Sem título",
      description: `${x.published?.["date-parts"]?.[0]?.[0] || "Ano não informado"}${doi ? " • DOI: " + doi : ""}`,
      url: safeUrl(x.URL || (doi ? `https://doi.org/${doi}` : "")),
      doi
    };
  });
}

function rank(items, q) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(x => x.length > 2);
  return items.map(x => {
    const title = String(x.title || "");
    const text = `${title} ${String(x.description || "")}`.toLowerCase();
    let score = 0;
    for (const word of terms) {
      if (text.includes(word)) score += 10;
      if (title.toLowerCase().includes(word)) score += 8;
    }
    if (x.doi) score += 3;
    if (x.citations) score += Math.min(x.citations / 100, 5);
    return { ...x, score };
  }).sort((a, b) => b.score - a.score);
}

function render(items) {
  results.innerHTML = items.length
    ? `<div class="grid">${items.map(x => `
      <article class="card">
        <div class="meta"><span class="tag">${esc(x.source)}</span><span class="tag">${esc(x.type)}</span></div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.description || "Sem descrição disponível.")}</p>
        <a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">Consultar fonte →</a>
      </article>`).join("")}</div>`
    : '<div class="card empty">Nenhum resultado encontrado.</div>';
}

function renderAnalysis(info) {
  const terms = Array.isArray(info?.terms) ? info.terms : [];
  analysis.classList.remove("hidden");
  analysis.innerHTML = `<b>Análise Humanitas</b>
    <p>Área provável: <strong>${esc(info?.area || "Ciências Humanas")}</strong></p>
    <p>Termos: ${terms.map(esc).join(", ") || "nenhum"}</p>`;
}

async function search(q) {
  const query = String(q || "").trim();
  if (!query) return;

  status.textContent = "Pesquisando...";
  results.innerHTML = '<div class="card empty">Consultando fontes...</div>';

  try {
    const info = await window.humanitasNLP?.analyze?.(query) || {
      area: "Ciências Humanas",
      terms: query.split(/\s+/)
    };
    renderAnalysis(info);

    const r = await Promise.allSettled([
      wiki(query),
      wikidata(query),
      openalex(query),
      crossref(query)
    ]);

    const items = r.flatMap(x => x.status === "fulfilled" ? x.value : []);
    render(rank(items, query));
    status.textContent = `Pesquisa concluída • ${items.length} resultados`;
  } catch (error) {
    console.error(error);
    results.innerHTML = '<div class="card">Não foi possível consultar as fontes. Verifique a conexão.</div>';
    status.textContent = "Erro de pesquisa";
  }
}

let routeCommand = null;
let aiEnabled = false;

async function enableLocalAI() {
  if (aiEnabled) return;

  aiButton.disabled = true;
  aiButton.textContent = "Carregando IA local...";
  aiState.textContent = "Primeira carga: o modelo pode ocupar cerca de 117 MB.";
  status.textContent = "Carregando roteador local...";

  try {
    ({ routeCommand } = await import("./ai/router.js"));
    await routeCommand("teste", (p) => {
      if (p?.status === "fallback") aiState.textContent = "WebGPU indisponível; usando CPU/WASM.";
      else if (p?.status === "loading") aiState.textContent = `Carregando modelo local • ${p.device || "CPU"}`;
      else if (p?.status === "ready") aiState.textContent = `IA local pronta • ${p.device} • ${p.dtype}`;
    });
    aiEnabled = true;
    aiButton.textContent = "IA local ativa";
    aiState.textContent = "Roteador local ativo. O modelo não fornece fontes acadêmicas.";
    status.textContent = "IA local pronta";
  } catch (error) {
    console.error(error);
    aiButton.disabled = false;
    aiButton.textContent = "Ativar IA local";
    aiState.textContent = "Não foi possível carregar o modelo. Verifique a conexão na primeira execução.";
    status.textContent = "Falha na IA local";
  }
}

async function handleCommand(input) {
  if (!aiEnabled || !routeCommand) return search(input);

  status.textContent = "Interpretando comando local...";
  try {
    const routed = await routeCommand(input, (p) => {
      if (p?.status === "loading") status.textContent = "Modelo local carregando...";
      if (p?.status === "ready") status.textContent = "Comando interpretado localmente";
    });

    if (routed.intent === "SEARCH" || routed.intent === "FILTER") {
      const q = routed.query || input;
      $("#query").value = q;
      return search(q);
    }

    if (routed.intent === "HELP") {
      results.innerHTML = '<div class="card"><b>Ajuda</b><p>Digite um assunto para pesquisar nas fontes Humanitas. O roteador local apenas interpreta o comando.</p></div>';
      status.textContent = "Ajuda";
      return;
    }

    results.innerHTML = `<div class="card"><b>Comando reconhecido</b><p>${esc(routed.intent)}. Esta ação ainda não está habilitada pela interface.</p></div>`;
    status.textContent = "Comando não executado";
  } catch (error) {
    console.error(error);
    status.textContent = "Falha no roteador; pesquisa direta usada";
    search(input);
  }
}

$("#searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  handleCommand($("#query").value);
});

document.querySelectorAll("[data-q]").forEach(b => {
  b.onclick = () => {
    $("#query").value = b.dataset.q;
    handleCommand(b.dataset.q);
  };
});

aiButton.addEventListener("click", enableLocalAI);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
}
