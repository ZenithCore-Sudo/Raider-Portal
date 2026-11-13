const crypto=require('crypto');
const schema=require('./_schema.json');
const env=process.env;
const REPO=env.GITHUB_REPO||'';
const BRANCH=env.GITHUB_BRANCH||'main';
const FILE=env.CONFIG_PATH||'config/site.json';
const TTL=8*3600*1000;
const fails=new Map();

const sha=s=>crypto.createHash('sha256').update(String(s)).digest();
const safeEq=(a,b)=>crypto.timingSafeEqual(sha(a),sha(b));
const b64u=b=>Buffer.from(b).toString('base64url');

function send(res,code,obj,extra){
  res.statusCode=code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(extra)for(const k of Object.keys(extra))res.setHeader(k,extra[k]);
  res.end(JSON.stringify(obj));
}

function sign(p){return crypto.createHmac('sha256',env.SESSION_SECRET).update(p).digest('base64url')}
function makeToken(){const p=b64u(JSON.stringify({exp:Date.now()+TTL,n:crypto.randomBytes(8).toString('hex')}));return p+'.'+sign(p)}
function readToken(req){
  if(!env.SESSION_SECRET)return false;
  const m=(req.headers.cookie||'').match(/(?:^|;\s*)rp_admin=([^;]+)/);
  if(!m)return false;
  const [p,s]=m[1].split('.');
  if(!p||!s)return false;
  const e=sign(p);
  if(s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return false;
  try{return JSON.parse(Buffer.from(p,'base64url').toString()).exp>Date.now()}catch(e){return false}
}
function cookie(v,age){return 'rp_admin='+v+'; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age='+age}

function sameOrigin(req){try{return new URL(req.headers.origin).host===req.headers.host}catch(e){return false}}

function guard(req,res,opts){
  opts=opts||{};
  if(opts.method&&req.method!==opts.method){send(res,405,{error:'method'});return false}
  if(opts.write){
    if(!sameOrigin(req)||req.headers['x-requested-with']!=='raider-admin'){send(res,403,{error:'forbidden'});return false}
  }
  if(!opts.open&&!readToken(req)){send(res,401,{error:'auth'});return false}
  return true;
}

function ip(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}
function throttled(req){const r=fails.get(ip(req));return r&&r.n>=8&&Date.now()-r.t<15*60*1000}
function noteFail(req){const k=ip(req),r=fails.get(k);fails.set(k,{n:(r&&Date.now()-r.t<15*60*1000?r.n:0)+1,t:Date.now()})}
function clearFail(req){fails.delete(ip(req))}

function body(req){
  let b=req.body;
  if(typeof b==='string'){try{b=JSON.parse(b)}catch(e){b=null}}
  return b&&typeof b==='object'?b:{};
}

const str=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max):'';
const URLRE=/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([\/?#][^\s|~]*)?$/i;

function clean(input){
  const out={};
  if(!input||typeof input!=='object')return out;
  for(const f of schema){
    if(!(f.k in input))continue;
    const v=input[f.k];
    let r;
    switch(f.t){
      case 'bool':if(typeof v==='boolean')r=v;break;
      case 'num':if(typeof v==='number'&&isFinite(v))r=Math.max(0,Math.min(100000,Math.round(v)));break;
      case 'str':r=typeof v==='string'?str(v,200):undefined;break;
      case 'text':r=typeof v==='string'?str(v,1000):undefined;break;
      case 'dt':if(typeof v==='string'&&(v===''||/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)))r=v;break;
      case 'select':if(typeof v==='string'&&f.o.includes(v))r=v;break;
      case 'multi':if(Array.isArray(v))r=v.filter(x=>f.o.includes(x));break;
      case 'list':if(Array.isArray(v))r=v.slice(0,300).map(x=>str(x,120).trim()).filter(Boolean);break;
      case 'map':if(v&&typeof v==='object'&&!Array.isArray(v)){r={};Object.keys(v).slice(0,20).forEach(k=>{const s=str(v[k],30).trim();if(s)r[str(k,20)]=s})}break;
      case 'faq':if(Array.isArray(v))r=v.slice(0,60).map(x=>({q:str(x&&x.q,200).trim(),a:str(x&&x.a,3000).trim()})).filter(x=>x.q&&x.a);break;
      case 'apps':if(Array.isArray(v))r=v.slice(0,300).map(x=>({n:str(x&&x.n,60).trim(),u:str(x&&x.u,300).trim(),c:str(x&&x.c,40).trim()||'More'})).filter(x=>x.n&&URLRE.test(x.u));break;
    }
    if(r!==undefined&&JSON.stringify(r)!==JSON.stringify(f.d))out[f.k]=r;
  }
  return out;
}

async function gh(p,opts){
  opts=opts||{};
  return fetch('https://api.github.com'+p,{...opts,headers:{authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'raider-portal-admin',...(opts.headers||{})}});
}
function ready(){return !!(REPO&&env.GITHUB_TOKEN)}

async function readFile(ref){
  const r=await gh('/repos/'+REPO+'/contents/'+FILE+'?ref='+encodeURIComponent(ref||BRANCH));
  if(r.status===404)return{data:{config:{},presets:{}},sha:null};
  if(!r.ok)throw new Error('github '+r.status);
  const j=await r.json();
  let d={};
  try{d=JSON.parse(Buffer.from(j.content,'base64').toString('utf8'))}catch(e){}
  return{data:{config:clean(d.config),presets:d.presets&&typeof d.presets==='object'?d.presets:{}},sha:j.sha};
}

async function writeFile(data,fileSha,message){
  const b={message:str(message,200)||'admin: update',content:Buffer.from(JSON.stringify(data,null,1)).toString('base64'),branch:BRANCH};
  if(fileSha)b.sha=fileSha;
  const r=await gh('/repos/'+REPO+'/contents/'+FILE,{method:'PUT',body:JSON.stringify(b)});
  if(r.status===409||r.status===422)return{conflict:true};
  if(!r.ok)throw new Error('github '+r.status);
  const j=await r.json();
  return{sha:j.content.sha,commit:j.commit.sha};
}

function cleanPresets(p){
  const o={};
  if(!p||typeof p!=='object')return o;
  Object.keys(p).slice(0,30).forEach(k=>{const n=str(k,40).trim();if(n)o[n]=clean(p[k])});
  return o;
}

module.exports={sameOrigin,send,guard,body,clean,cleanPresets,readFile,writeFile,gh,ready,makeToken,cookie,safeEq,throttled,noteFail,clearFail,readToken,env,REPO,BRANCH,FILE,schema,URLRE};
