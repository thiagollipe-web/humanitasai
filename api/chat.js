const MODEL = "gemma-4-26b-a4b-it";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Método não permitido."});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(500).json({error:"GEMINI_API_KEY não configurada na Vercel."});
  try {
    const body=req.body||{};
    const q=String(body.question||"").trim();
    if(!q)return res.status(400).json({error:"Pergunta vazia."});
    const refs=Array.isArray(body.references)?body.references.slice(0,16):[];
    const context=refs.map(function(r){
      return "["+r.n+"] "+r.source+" — "+r.title+"\nTipo: "+r.type+"\nDescrição: "+(r.description||"Sem descrição")+"\nURL: "+(r.url||"");
    }).join("\n\n");
    const systemInstruction="Você é o Humanitas, um assistente de pesquisa em Ciências Humanas. Responda em português do Brasil, com clareza e rigor. Use as referências fornecidas como base documental. Não invente referências, autores, DOI, páginas ou fatos que não estejam sustentados pelo contexto. Quando uma afirmação estiver apoiada por uma referência, indique [n] usando o número fornecido. Se as referências não forem suficientes, diga isso explicitamente. Diferencie fatos documentados, interpretação acadêmica e incerteza. Não apresente sua própria resposta como fonte acadêmica.";
    const input="REFERÊNCIAS DO HUMANITAS:\n\n"+(context||"Nenhuma referência disponível.")+"\n\nPERGUNTA DO USUÁRIO:\n"+q;
    const payload={model:MODEL,input:input,system_instruction:systemInstruction,store:true};
    if(body.previousInteractionId)payload.previous_interaction_id=body.previousInteractionId;
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
      method:"POST",
      headers:{"x-goog-api-key":key,"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const data=await response.json();
    if(!response.ok)return res.status(response.status).json({error:(data.error&&data.error.message)||"Erro na API Gemini."});
    var answer=data.output_text||"";
    if(!answer&&Array.isArray(data.steps)){
      answer=data.steps.filter(function(s){return s.type==="model_output";}).flatMap(function(s){return s.content||[];}).filter(function(c){return c.type==="text";}).map(function(c){return c.text;}).join("\n");
    }
    return res.status(200).json({answer:answer,interactionId:data.id||null,model:MODEL});
  }catch(error){
    console.error(error);
    return res.status(500).json({error:"Erro interno ao consultar o Humanitas."});
  }
}