// DONA MAKES - API (Cloudflare Pages + D1). Sem dependências.
// Variáveis: ADMIN_USER e ADMIN_PASSWORD. Banco D1: binding chamado DB.
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...h}});
class Err extends Error{constructor(m,s=400){super(m);this.s=s}}
const enc=new TextEncoder(),now=()=>Date.now();
const rid=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16);
const sha=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(s??''))));
async function igual(a,b){const x=await sha(a),y=await sha(b);let d=0;for(let i=0;i<32;i++)d|=x[i]^y[i];return d===0}
const SEED=[['Body Splash Flor de Cerejeira','Fragrância corporal leve e refrescante para o dia a dia.',39.9,29.9,'Perfumaria',25,'frasco'],['Gloss Labial Cristal','Brilho intenso com efeito volumoso e toque macio.',24.9,0,'Maquiagem',3,'tubo'],['Sérum Facial Vitamina C','Uniformiza o tom e ilumina a pele.',79.9,64.9,'Skincare',12,'serum'],['Espuma Facial de Limpeza','Limpeza suave que remove impurezas sem ressecar.',34.9,0,'Skincare',4,'pump'],['Sabonete Líquido Floral','Perfume delicado e espuma cremosa.',24.9,19.9,'Autocuidado',30,'pump'],['Kit de Banho Relax','Sabonete, esfoliante e hidratante para um banho especial.',119.9,99.9,'Autocuidado',8,'pote'],['Hidratante Corporal Rosas','Hidratação por 24 horas com aroma de rosas.',44.9,0,'Autocuidado',18,'tubo'],['Pó Translúcido','Controla a oleosidade e dá acabamento aveludado.',54.9,0,'Maquiagem',2,'pote']];
let pronto=false;
async function iniciar(DB){if(pronto)return;
 const T=['CREATE TABLE IF NOT EXISTS categorias(nome TEXT PRIMARY KEY,ordem INTEGER DEFAULT 0)','CREATE TABLE IF NOT EXISTS produtos(id TEXT PRIMARY KEY,nome TEXT NOT NULL,descr TEXT DEFAULT \'\',preco REAL NOT NULL,promo REAL DEFAULT 0,cat TEXT NOT NULL,estoque INTEGER DEFAULT 0,tipo TEXT DEFAULT \'\',status TEXT DEFAULT \'ativo\',criado INTEGER)','CREATE TABLE IF NOT EXISTS imagens(id TEXT PRIMARY KEY,produto TEXT NOT NULL,ordem INTEGER DEFAULT 0,dados TEXT NOT NULL)','CREATE INDEX IF NOT EXISTS ix_img ON imagens(produto,ordem)','CREATE TABLE IF NOT EXISTS tentativas(ip TEXT PRIMARY KEY,n INTEGER,ate INTEGER)','CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT)'];
 await DB.batch(T.map(s=>DB.prepare(s)));
 if(!await DB.prepare("SELECT 1 x FROM meta WHERE k='seed'").first()){const t=now(),q=[];
  ['Maquiagem','Skincare','Perfumaria','Autocuidado'].forEach((c,i)=>q.push(DB.prepare('INSERT OR IGNORE INTO categorias(nome,ordem) VALUES(?,?)').bind(c,i)));
  SEED.forEach((s,i)=>q.push(DB.prepare("INSERT INTO produtos(id,nome,descr,preco,promo,cat,estoque,tipo,status,criado) VALUES(?,?,?,?,?,?,?,?,'ativo',?)").bind('p'+rid(),s[0],s[1],s[2],s[3],s[4],s[5],s[6],t-i*1000)));
  q.push(DB.prepare("INSERT INTO meta(k,v) VALUES('seed','1')"));await DB.batch(q)}
 pronto=true}
// ---- validação
const txt=(v,min,max,n)=>{v=String(v??'').trim();if(v.length<min||v.length>max)throw new Err(`${n}: use de ${min} a ${max} caracteres`);return v};
const num=(v,n)=>{v=Number(v);if(!isFinite(v)||v<0||v>100000)throw new Err(`${n} inválido`);return Math.round(v*100)/100};
const inteiro=(v,n)=>{v=Number(v);if(!Number.isInteger(v)||v<0||v>100000)throw new Err(`${n} inválido`);return v};
const okId=s=>typeof s==='string'&&/^[a-z0-9]{1,40}$/i.test(s);
// ---- autenticação simples (sem token/sessão): usuário e senha vão em cada pedido do painel
async function auth(req,env,DB,usuario,senha){
 if(!env.ADMIN_USER||!env.ADMIN_PASSWORD)throw new Err('Login não configurado no servidor (ADMIN_USER e ADMIN_PASSWORD)',500);
 const ip=req.headers.get('CF-Connecting-IP')||'local',r=await DB.prepare('SELECT n,ate FROM tentativas WHERE ip=?').bind(ip).first(),t=now();
 if(r&&r.n>=5&&r.ate>t)throw new Err('Muitas tentativas. Aguarde 15 minutos.',429);
 const ok=(await igual(usuario,env.ADMIN_USER))&(await igual(senha,env.ADMIN_PASSWORD));
 if(!ok){const n=(r&&r.ate>t?r.n:0)+1;await DB.prepare('INSERT INTO tentativas(ip,n,ate) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET n=excluded.n,ate=excluded.ate').bind(ip,n,t+9e5).run();throw new Err('Usuário ou senha incorretos',401)}
 if(r)await DB.prepare('DELETE FROM tentativas WHERE ip=?').bind(ip).run()}
async function authHeader(req,env,DB){const h=req.headers.get('X-Admin')||'',i=h.indexOf(':');let u='',s='';try{if(i>0){u=decodeURIComponent(h.slice(0,i));s=decodeURIComponent(h.slice(i+1))}}catch(e){}
 try{await auth(req,env,DB,u,s)}catch(e){if(e instanceof Err&&e.s===401)throw new Err('Sessão expirada. Entre novamente.',401);throw e}}
// ---- dados
async function listar(DB,admin){const P=(await DB.prepare(`SELECT * FROM produtos ${admin?'':"WHERE status='ativo'"} ORDER BY criado DESC`).all()).results;
 const I=(await DB.prepare('SELECT id,produto FROM imagens ORDER BY produto,ordem').all()).results,m={};I.forEach(i=>(m[i.produto]??=[]).push('/api/img/'+i.id));
 const C=(await DB.prepare('SELECT nome FROM categorias ORDER BY ordem,nome').all()).results.map(c=>c.nome);
 return{produtos:P.map(p=>({id:p.id,nome:p.nome,desc:p.descr,preco:p.preco,promo:p.promo,cat:p.cat,estoque:p.estoque,tipo:p.tipo,status:p.status,criado:p.criado,imgs:m[p.id]||[]})),categorias:C}}
async function salvar(DB,b){let id=b.id,ex=null;if(id){if(!okId(id))throw new Err('Produto inválido');ex=await DB.prepare('SELECT * FROM produtos WHERE id=?').bind(id).first();if(!ex)throw new Err('Produto não encontrado',404)}else id='p'+rid();
 const nome=txt(b.nome,1,120,'Nome'),desc=txt(b.desc,0,600,'Descrição'),preco=num(b.preco,'Preço'),promo=num(b.promo||0,'Promoção'),est=inteiro(b.estoque,'Estoque'),st=b.status==='inativo'?'inativo':'ativo';
 if(promo>0&&promo>=preco)throw new Err('A promoção deve ser menor que o preço');
 if(!await DB.prepare('SELECT 1 x FROM categorias WHERE nome=?').bind(String(b.cat)).first())throw new Err('Categoria inválida');
 const imgs=Array.isArray(b.imgs)?b.imgs:[];if(imgs.length>5)throw new Err('Máximo de 5 fotos por produto');
 const q=[DB.prepare("INSERT INTO produtos(id,nome,descr,preco,promo,cat,estoque,tipo,status,criado) VALUES(?,?,?,?,?,?,?,'',?,?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,descr=excluded.descr,preco=excluded.preco,promo=excluded.promo,cat=excluded.cat,estoque=excluded.estoque,status=excluded.status").bind(id,nome,desc,preco,promo,b.cat,est,st,now())];
 const keep=[],ops=[];imgs.forEach((s,i)=>{const m=typeof s==='string'&&s.match(/^\/api\/img\/([a-z0-9]+)$/i);
  if(m){keep.push(m[1]);ops.push(DB.prepare('UPDATE imagens SET ordem=? WHERE id=? AND produto=?').bind(i,m[1],id))}
  else if(typeof s==='string'&&s.length<400000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s))ops.push(DB.prepare('INSERT INTO imagens(id,produto,ordem,dados) VALUES(?,?,?,?)').bind(rid(),id,i,s));
  else throw new Err('Foto inválida: use JPG/PNG de até ~300 KB')});
 q.push(DB.prepare(`DELETE FROM imagens WHERE produto=?${keep.length?` AND id NOT IN (${keep.map(()=>'?').join(',')})`:''}`).bind(id,...keep),...ops);
 await DB.batch(q);return id}
async function campo(DB,b){if(!okId(b.id))throw new Err('Produto inválido');const p=await DB.prepare('SELECT * FROM produtos WHERE id=?').bind(b.id).first();if(!p)throw new Err('Produto não encontrado',404);
 let c=b.campo,v;if(c==='preco')v=num(b.valor,'Preço');else if(c==='promo')v=num(b.valor,'Promoção');else if(c==='estoque')v=inteiro(b.valor,'Estoque');else if(c==='status'){v=b.valor==='inativo'?'inativo':'ativo'}else throw new Err('Campo inválido');
 const pr=c==='preco'?v:p.preco,pm=c==='promo'?v:p.promo;if(pm>0&&pm>=pr)throw new Err('A promoção deve ser menor que o preço');
 await DB.prepare(`UPDATE produtos SET ${c}=? WHERE id=?`).bind(v,b.id).run()}
async function categoria(DB,b){const a=b.acao;
 if(a==='add'){const n=txt(b.nome,1,40,'Nome');if(await DB.prepare('SELECT 1 x FROM categorias WHERE nome=?').bind(n).first())throw new Err('Essa categoria já existe');const o=await DB.prepare('SELECT COALESCE(MAX(ordem),-1)+1 o FROM categorias').first();await DB.prepare('INSERT INTO categorias(nome,ordem) VALUES(?,?)').bind(n,o.o).run()}
 else if(a==='ren'){const n=txt(b.novo,1,40,'Nome'),o=String(b.nome);if(n!==o&&await DB.prepare('SELECT 1 x FROM categorias WHERE nome=?').bind(n).first())throw new Err('Essa categoria já existe');await DB.batch([DB.prepare('UPDATE categorias SET nome=? WHERE nome=?').bind(n,o),DB.prepare('UPDATE produtos SET cat=? WHERE cat=?').bind(n,o)])}
 else if(a==='del'){const n=String(b.nome);if(await DB.prepare('SELECT 1 x FROM produtos WHERE cat=?').bind(n).first())throw new Err('Mova ou exclua os produtos desta categoria antes');await DB.prepare('DELETE FROM categorias WHERE nome=?').bind(n).run()}
 else throw new Err('Ação inválida')}
// ---- roteador
async function onRequest({request:req,env}){try{
 const url=new URL(req.url),rota=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,''),M=req.method;
 const DB=env.DB||Object.values(env).find(v=>v&&typeof v.prepare==='function'&&typeof v.batch==='function');
 if(!DB)throw new Err('Banco de dados não configurado: adicione um binding D1 chamado DB',500);
 await iniciar(DB);
 if(M==='GET'&&rota==='loja')return J(await listar(DB,false),200,{'Cache-Control':'public, max-age=20'});
 if(M==='GET'&&rota.startsWith('img/')){const id=rota.slice(4);if(!okId(id))return J({erro:'Não encontrada'},404);const r=await DB.prepare('SELECT dados FROM imagens WHERE id=?').bind(id).first();if(!r)return J({erro:'Não encontrada'},404);
  const bin=Uint8Array.from(atob(r.dados.split(',')[1]),c=>c.charCodeAt(0));return new Response(bin,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}})}
 if(M==='POST'){const o=req.headers.get('Origin');if((o&&o!==url.origin)||req.headers.get('X-Requested-With')!=='dm')throw new Err('Requisição bloqueada',403);if(+req.headers.get('Content-Length')>3e6)throw new Err('Arquivo muito grande',413)}
 let b={};if(M==='POST'){try{b=await req.json()}catch(e){throw new Err('Dados inválidos')}}
 if(M==='POST'&&rota==='login'){await auth(req,env,DB,b.usuario,b.senha);return J({ok:true})}
 if(rota.startsWith('admin/')){await authHeader(req,env,DB);
  if(M==='GET'&&rota==='admin/me')return J({ok:true});
  if(M==='GET'&&rota==='admin/dados')return J(await listar(DB,true));
  if(M==='POST'&&rota==='admin/produto')return J({id:await salvar(DB,b)});
  if(M==='POST'&&rota==='admin/campo'){await campo(DB,b);return J({ok:true})}
  if(M==='POST'&&rota==='admin/excluir'){if(!okId(b.id))throw new Err('Produto inválido');await DB.batch([DB.prepare('DELETE FROM imagens WHERE produto=?').bind(b.id),DB.prepare('DELETE FROM produtos WHERE id=?').bind(b.id)]);return J({ok:true})}
  if(M==='POST'&&rota==='admin/cat'){await categoria(DB,b);return J({ok:true})}}
 return J({erro:'Não encontrado'},404)}
 catch(e){if(e instanceof Err)return J({erro:e.message},e.s);console.error(e);return J({erro:'Erro no servidor. Tente de novo.'},500)}}
// ---- entrada: /api/* vai pra API, o resto são os arquivos do site (+ cabeçalhos de segurança)
const SEC={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"};
export default{async fetch(request,env){const u=new URL(request.url);let r=u.pathname.startsWith('/api/')?await onRequest({request,env}):await env.ASSETS.fetch(request);
 r=new Response(r.body,r);for(const k in SEC)r.headers.set(k,SEC[k]);if(/^\/admin/.test(u.pathname))r.headers.set('X-Robots-Tag','noindex, nofollow');return r}};
