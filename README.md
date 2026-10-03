# Humanitas

Sistema de Conhecimento em Ciências Humanas.

## Arquitetura

- HTML/CSS: interface PWA.
- JavaScript: pesquisa, integração, ranking e chat.
- PyScript/Python: análise linguística local.
- Ollama Cloud: geração das respostas do chat.
- Fontes: Wikimedia, Wikidata, OpenAlex e Crossref.

## Chat com referências

O Humanitas pesquisa primeiro em Wikimedia, Wikidata, OpenAlex e Crossref. Os resultados são enviados como contexto documental para o chat.

O chat usa o Ollama Cloud, mantendo a chave da API somente no backend serverless da Vercel. O navegador não recebe a chave.

O modelo padrão é `gemma4:31b`. Ele pode ser alterado pela variável `OLLAMA_MODEL` na Vercel.

As respostas são instruídas a indicar as referências utilizadas com marcadores como `[1]`, `[2]` e assim por diante. As referências também são exibidas abaixo da resposta.

### Configuração da Vercel

Crie as variáveis de ambiente:

```text
OLLAMA_API_KEY=sua_chave_do_ollama
OLLAMA_MODEL=gemma4:31b
```

A `OLLAMA_API_KEY` deve ser mantida em segredo e nunca colocada no HTML, JavaScript do navegador ou repositório.

Depois faça um novo deploy.

## Publicação

O projeto é compatível com GitHub Pages para a interface, mas o chat cloud depende da função serverless `/api/chat`. Para usar o chat completo, publique o projeto em uma plataforma que execute essa função, como a Vercel.
