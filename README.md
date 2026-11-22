# ToutchieToYou API

API para publicar e excluir postagens do blog, hospedada como Vercel Function. O conteúdo é salvo no JSON do repositório do blog por meio da API do GitHub.

## Configuração na Vercel

Importe este repositório e configure, em **Settings → Environment Variables**, para o ambiente Production:

- `GITHUB_TOKEN`: credencial fine-grained restrita ao repositório `PSjoon/ToutchieToYou`, com Contents: Read and write. Selecione o tipo Secret.
- `ADMIN_PASSWORD`: senha para excluir posts. Selecione o tipo Secret.

Após salvar as variáveis, faça um novo deploy. No projeto do blog, configure `apiBaseUrl` em `config.js` com a URL de produção da Vercel, sem barra final. A senha é solicitada somente ao excluir e não é enviada ao GitHub.

A API permite chamadas do navegador apenas de `https://psjoon.github.io`. Publicações são abertas: qualquer pessoa que acessar a API pode criar posts, inclusive fora do navegador. Exclusões exigem a senha. Use uma credencial de escopo mínimo e não inclua segredos no código ou em commits.

O GitHub Pages pode demorar após o commit. Se duas solicitações alterarem o JSON ao mesmo tempo, a API tenta novamente usando a versão mais recente.

Teste local de sintaxe: `node --check api/posts.js`.
