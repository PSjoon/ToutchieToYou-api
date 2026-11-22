import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/posts.js';

function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},end(){return this}}}
test('deletes a post without a password',async()=>{
  process.env.GITHUB_TOKEN='example-token';
  const originalFetch=globalThis.fetch;let written;
  globalThis.fetch=async (_url,options)=>options.method==='PUT'?(written=JSON.parse(options.body),{ok:true}):({ok:true,json:async()=>({sha:'old-sha',content:Buffer.from(JSON.stringify([{id:'example'},{id:'keep'}])).toString('base64')})});
  try{const res=response();await handler({method:'DELETE',headers:{},body:{id:'example'}},res);assert.equal(res.code,200);assert.deepEqual(JSON.parse(Buffer.from(written.content,'base64').toString()).map(p=>p.id),['keep']);}finally{globalThis.fetch=originalFetch;}
});
test('writes a new post based on the latest GitHub JSON',async()=>{
  process.env.ADMIN_PASSWORD='example-password';process.env.GITHUB_TOKEN='example-token';
  const originalFetch=globalThis.fetch;let written;
  globalThis.fetch=async (_url,options)=>options.method==='PUT'?(written=JSON.parse(options.body),{ok:true}):({ok:true,json:async()=>({sha:'old-sha',content:Buffer.from(JSON.stringify([{id:'existing'}])).toString('base64')})});
  try{const res=response();await handler({method:'POST',headers:{},body:{post:{id:'new',title:'Título',body:'Texto',excerpt:'Resumo',author:'Antonieta',category:'Cultura',created_at:'2026-01-01T00:00:00Z',cover:''}}},res);assert.equal(res.code,200);assert.equal(written.sha,'old-sha');assert.deepEqual(JSON.parse(Buffer.from(written.content,'base64').toString()).map(p=>p.id),['new','existing']);}finally{globalThis.fetch=originalFetch;}
});
test('reports the GitHub read status without exposing the credential',async()=>{
  process.env.ADMIN_PASSWORD='example-password';process.env.GITHUB_TOKEN='example-secret-token';
  const originalFetch=globalThis.fetch, originalError=console.error;let log;
  globalThis.fetch=async()=>({ok:false,status:401,headers:new Headers({'x-github-request-id':'request-1'})});
  console.error=(...args)=>{log=args};
  try{const res=response();await handler({method:'POST',headers:{},body:{post:{id:'new',title:'Título',body:'Texto',excerpt:'Resumo',author:'Antonieta',category:'Cultura',created_at:'2026-01-01T00:00:00Z',cover:''}}},res);assert.equal(res.code,502);assert.match(res.body.error,/ler.*HTTP 401/);assert.equal(log[1].operation,'read');assert.equal(log[1].status,401);assert.doesNotMatch(JSON.stringify([log,res.body]),/example-secret-token/);}finally{globalThis.fetch=originalFetch;console.error=originalError;}
});
