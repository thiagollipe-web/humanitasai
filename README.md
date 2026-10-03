# Humanitas

Sistema de Conhecimento em Ciências Humanas.

## Arquitetura

- HTML/CSS: interface PWA.
- JavaScript: pesquisa, integração, ranking e execução controlada de comandos.
- PyScript/Python: análise linguística local.
- SmolLM2-135M-Instruct: roteador SLM local opcional no navegador.
- Fontes: Wikimedia, Wikidata, OpenAlex e Crossref.

O SLM não é usado para gerar respostas acadêmicas nem referências. Ele apenas transforma comandos em intenções estruturadas; a aplicação decide quais ações permitidas podem ser executadas.

## IA local

O Humanitas usa Transformers.js 4.0.1 e o modelo ONNX
`onnx-community/SmolLM2-135M-Instruct-ONNX`.

- WebGPU: tenta `q4f16` e depois `q4`.
- CPU/WASM: usa `q4`.
- O modelo é baixado na primeira ativação e pode ser reutilizado pelo cache do navegador.
- A primeira carga exige conexão; as pesquisas acadêmicas continuam dependendo das APIs externas.
- O navegador pode remover dados de cache; portanto, o projeto não promete armazenamento permanente do modelo.

## Publicação

O projeto é compatível com GitHub Pages e não exige servidor próprio para a interface.
