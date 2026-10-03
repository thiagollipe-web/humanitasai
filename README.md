# Humanitas

Sistema de Conhecimento em Ciências Humanas.

## Arquitetura

- HTML/CSS: interface PWA.
- JavaScript: pesquisa, integração, ranking e execução controlada de comandos.
- PyScript/Python: análise linguística local.
- Gemma 4 26B A4B IT: chat cloud de pesquisa, executado por uma função serverless na Vercel.
- Fontes: Wikimedia, Wikidata, OpenAlex e Crossref.

O SLM não é usado para gerar respostas acadêmicas nem referências. Ele apenas transforma comandos em intenções estruturadas; a aplicação decide quais ações permitidas podem ser executadas.

## Chat com referências

O Humanitas pesquisa primeiro em Wikimedia, Wikidata, OpenAlex e Crossref. Os resultados são enviados como contexto documental para o chat cloud.

O chat usa o modelo `gemma-4-26b-a4b-it` pela API Gemini. A chave da API não fica no navegador nem no repositório: a função `api/chat.js` lê `GEMINI_API_KEY` como variável de ambiente da Vercel.

O chat solicita que as respostas indiquem as referências utilizadas com marcadores como `[1]`, `[2]` e assim por diante. As referências também são exibidas como links abaixo da resposta.

### Configuração da Vercel

Crie a variável de ambiente:

```text
GEMINI_API_KEY=sua_chave_do_google_ai_studio
```

Depois faça um novo deploy.

## Publicação

O projeto é compatível com GitHub Pages e não exige servidor próprio para a interface.
