import { timingSafeEqual } from 'node:crypto';

const origin = 'https://psjoon.github.io';
const endpoint = 'https://api.github.com/repos/PSjoon/ToutchieToYou/contents/data/posts.json';
const categories = ['Tecnologia', 'Cultura', 'Games', 'Devaneios'];
const valid = p => p && typeof p.id === 'string' && p.id.length <= 100 && typeof p.title === 'string' && p.title.trim().length > 0 && p.title.length <= 140 && typeof p.body === 'string' && p.body.trim().length > 0 && p.body.length <= 40000 && typeof p.excerpt === 'string' && p.excerpt.length <= 280 && p.author === 'Antonieta' && categories.includes(p.category) && Number.isFinite(Date.parse(p.created_at)) && (p.cover === '' || (typeof p.cover === 'string' && p.cover.length <= 2000 && /^https:\/\//i.test(p.cover)));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['POST', 'DELETE'].includes(req.method)) return res.status(405).json({error:'Método não permitido.'});
  const password = process.env.ADMIN_PASSWORD, token = process.env.GITHUB_TOKEN;
  if (!token || (req.method === 'DELETE' && !password)) return res.status(503).json({error:'API não configurada.'});
  if (req.method === 'DELETE') {
    const expected = Buffer.from(password), supplied = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({error:'Senha incorreta.'});
  }
  const input = req.body;
  if (!input || (req.method === 'POST' ? !valid(input.post) : typeof input.id !== 'string' || input.id.length > 100)) return res.status(400).json({error:'Dados inválidos.'});
  const headers = {Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json', 'User-Agent':'ToutchieToYou-API'};
  let stage = 'github_read';
  const githubFailure = (operation, response) => {
    console.error('github_request_failed', {operation, status:response.status, requestId:response.headers?.get('x-github-request-id') || null});
    let hint = 'Verifique os logs da API.';
    if (response.status === 401) hint = 'Verifique se a credencial do GitHub é válida e está ativa.';
    else if (response.status === 403) hint = 'Verifique as permissões da credencial e as regras do repositório.';
    else if (response.status === 404) hint = 'Verifique o acesso ao repositório e o caminho do arquivo.';
    else if (response.status === 422) hint = 'O GitHub rejeitou a atualização; verifique as regras do repositório.';
    return res.status(502).json({error:`Falha ao ${operation === 'read' ? 'ler' : 'atualizar'} o GitHub (HTTP ${response.status}). ${hint}`});
  };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      stage = 'github_read';
      const read = await fetch(endpoint, {headers});
      if (!read.ok) return githubFailure('read', read);
      stage = 'parse_posts';
      const file = await read.json();
      const posts = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (!Array.isArray(posts)) throw new Error('format');
      let next;
      if (req.method === 'POST') {
        if (posts.some(p => p.id === input.post.id)) return res.status(409).json({error:'Postagem já existe.'});
        const {id,title,category,author,created_at,excerpt,body,cover} = input.post;
        next = [{id,title,category,author,created_at,excerpt,body,cover}, ...posts];
      } else {
        if (!posts.some(p => p.id === input.id)) return res.status(404).json({error:'Postagem não encontrada.'});
        next = posts.filter(p => p.id !== input.id);
      }
      stage = 'github_write';
      const update = await fetch(endpoint, {method:'PUT',headers,body:JSON.stringify({message:req.method === 'POST' ? 'Publicar postagem' : 'Excluir postagem',content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64'),sha:file.sha,branch:'main'})});
      if (update.ok) return res.status(200).json({ok:true});
      if (update.status !== 409) return githubFailure('write', update);
      console.warn('github_update_conflict', {attempt:attempt+1, status:update.status});
    }
    return res.status(409).json({error:'Conflito ao atualizar. Tente novamente.'});
  } catch (error) {
    console.error('posts_api_failed', {stage, errorType: error instanceof Error ? error.name : 'Unknown'});
    return res.status(502).json({error:stage === 'parse_posts' ? 'Não foi possível interpretar o JSON das postagens. Verifique os logs da API.' : 'Falha de comunicação com o GitHub. Verifique os logs da API.'});
  }
}
