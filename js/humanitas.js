const $ = (s) => document.querySelector(s);
const status = $("#status");
const analysis = $("#analysis");
const results = $("#results");
const chatMessages = $("#chatMessages");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");

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
    var ranked=rank(items, query); currentReferences=referenceData(ranked); chatHistory=[]; previousInteractionId=null; render(ranked);
    status.textContent = `Pesquisa concluída • ${items.length} resultados`;
  } catch (error) {
    console.error(error);
    results.innerHTML = '<div class="card">Não foi possível consultar as fontes. Verifique a conexão.</div>';
    status.textContent = "Erro de pesquisa";
  }
}


let currentReferences=[];
let previousInteractionId=null;
let chatHistory=[];

function referenceData(items){
  return items.slice(0,16).map(function(x,i){
    return {n:i+1,source:x.source,type:x.type,title:x.title,description:x.description,url:safeUrl(x.url),doi:x.doi||""};
  });
}

function addMessage(role,text,references){
  references=references||[];
  var box=document.createElement("div");
  box.className="chat-message "+role;
  var label=role==="user"?"Você":"Humanitas";
  box.innerHTML="<strong>"+label+"</strong><p>"+esc(text).replace(/\n/g,"<br>")+"</p>";
  if(role==="assistant"&&references.length){
    var refs=document.createElement("div");
    refs.className="chat-references";
    refs.innerHTML="<strong>Referências utilizadas</strong>"+references.map(function(r){
      return '<a href="'+esc(safeUrl(r.url))+'" target="_blank" rel="noopener noreferrer">['+r.n+'] '+esc(r.title)+' <small>• '+esc(r.source)+'</small></a>';
    }).join("");
    box.appendChild(refs);
  }
  chatMessages.appendChild(box);
  chatMessages.scrollTop=chatMessages.scrollHeight;
  return box;
}

async function askHumanitas(question){
  if(!currentReferences.length){
    addMessage("assistant","Faça primeiro uma pesquisa. Assim o Humanitas terá referências para fundamentar a conversa.");
    return;
  }
  var loading=addMessage("assistant","Consultando as referências...");
  status.textContent="Consultando IA cloud...";
  try{
    var response=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({question:question,references:currentReferences,history:chatHistory})
    });
    var data=await response.json();
    loading.remove();
    if(!response.ok)throw Error(data.error||"Falha na IA cloud.");
    previousInteractionId=data.interactionId||previousInteractionId;
    var answer=data.answer||"Não foi possível obter uma resposta.";
    addMessage("assistant",answer,currentReferences);
    chatHistory.push({role:"user",content:question});
    chatHistory.push({role:"assistant",content:answer});
    chatHistory=chatHistory.slice(-10);
    status.textContent="Resposta concluída";
  }catch(error){
    loading.remove();
    addMessage("assistant","Não foi possível responder agora: "+error.message);
    status.textContent="Erro na IA cloud";
  }
}

$("#searchForm").addEventListener("submit",function(e){e.preventDefault();search($("#query").value)});
document.querySelectorAll("[data-q]").forEach(function(b){b.onclick=function(){$("#query").value=b.dataset.q;search(b.dataset.q)}});

chatForm.addEventListener("submit",async function(e){
  e.preventDefault();
  var question=chatInput.value.trim();
  if(!question)return;
  chatInput.value="";
  addMessage("user",question);
  await askHumanitas(question);
});
chatInput.addEventListener("keydown",function(e){
  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();chatForm.requestSubmit();}
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
}
