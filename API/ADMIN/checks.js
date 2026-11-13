const L=require('../_lib');
const dns=require('dns').promises;
const net=require('net');

const timed=async(fn)=>{const t=Date.now();try{const r=await fn();return{...r,ms:Date.now()-t}}catch(e){return{status:'fail',detail:String(e.message||e).slice(0,160),ms:Date.now()-t}}};
const to=(ms)=>AbortSignal.timeout(ms);
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function privateIp(a){
  if(net.isIPv6(a))return a==='::1'||/^f[cd]/i.test(a)||/^fe80/i.test(a);
  const p=a.split('.').map(Number);
  return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127);
}
async function safeHost(h){
  if(net.isIP(h))return !privateIp(h);
  const r=await dns.lookup(h,{all:true});
  return r.length>0&&r.every(x=>!privateIp(x.address));
}
async function linkCheck(raw){
  const u=/^https?:\/\//i.test(raw)?raw:'https://'+raw;
  let url;try{url=new URL(u)}catch(e){return{url:raw,status:'fail',detail:'invalid link'}}
  if(!L.URLRE.test(u)&&!/^https?:\/\/[^\s]+$/i.test(u))return{url:raw,status:'fail',detail:'invalid link'};
  const t=Date.now();
  try{
    if(!(await safeHost(url.hostname)))return{url:raw,status:'fail',detail:'blocked address'};
    let r=await fetch(url,{method:'HEAD',redirect:'manual',signal:to(6000),headers:{'user-agent':UA}});
    if(r.status===405||r.status===403||r.status===501)r=await fetch(url,{method:'GET',redirect:'manual',signal:to(6000),headers:{'user-agent':UA}});
    const ok=r.status<400;
    return{url:raw,status:ok?'ok':(r.status===403||r.status===401||r.status===429?'warn':'fail'),detail:'HTTP '+r.status+(r.status>=300&&r.status<400?' redirect':''),ms:Date.now()-t};
  }catch(e){return{url:raw,status:'fail',detail:String(e.cause&&e.cause.code||e.name||'error'),ms:Date.now()-t}}
}

module.exports=async(req,res)=>{
  if(!L.guard(req,res))return;
  const host=L.env.VERCEL_PROJECT_PRODUCTION_URL||req.headers.host;
  const base='https://'+host;

  if(req.method==='POST'){
    if(!L.guard(req,res,{write:true}))return;
    const urls=(Array.isArray(L.body(req).urls)?L.body(req).urls:[]).slice(0,60).map(x=>String(x).slice(0,300));
    const out=[];
    for(let i=0;i<urls.length;i+=6)out.push(...await Promise.all(urls.slice(i,i+6).map(linkCheck)));
    L.send(res,200,{links:out});
    return;
  }

  const checks=[];
  const add=async(name,fn)=>checks.push({name,...await timed(fn)});

  await add('Environment variables',async()=>{
    const need=['ADMIN_PASSWORD','SESSION_SECRET','GITHUB_TOKEN','GITHUB_REPO'];
    const miss=need.filter(k=>!L.env[k]);
    const weak=L.env.SESSION_SECRET&&L.env.SESSION_SECRET.length<32;
    return miss.length?{status:'fail',detail:'Missing: '+miss.join(', ')}:weak?{status:'warn',detail:'SESSION_SECRET should be at least 32 characters'}:{status:'ok',detail:'All required variables are set'};
  });

  await add('GitHub access',async()=>{
    const r=await L.gh('/repos/'+L.REPO,{signal:to(8000)});
    if(!r.ok)return{status:'fail',detail:'HTTP '+r.status+' reading '+L.REPO};
    const j=await r.json();
    return j.permissions&&j.permissions.push?{status:'ok',detail:L.REPO+' on '+L.BRANCH+', write access'+(j.private?', private':', PUBLIC repo')}:{status:'fail',detail:'Token cannot write to the repo'};
  });

  await add('Settings file',async()=>{
    const f=await L.readFile();
    return f.sha?{status:'ok',detail:Object.keys(f.data.config).length+' saved overrides in '+L.FILE}:{status:'warn',detail:'No settings saved yet. The site is using its defaults.'};
  });

  await add('Public settings endpoint',async()=>{
    const r=await fetch(base+'/api/config',{signal:to(8000),headers:{'user-agent':UA}});
    if(!r.ok)return{status:'fail',detail:'HTTP '+r.status};
    const j=await r.json();
    return typeof j==='object'&&!Array.isArray(j)?{status:'ok',detail:'Serving '+Object.keys(j).length+' overrides, cache: '+(r.headers.get('cache-control')||'none')}:{status:'fail',detail:'Unexpected response'};
  });

  await add('Health endpoint',async()=>{
    const r=await fetch(base+'/api/health',{signal:to(8000),headers:{'user-agent':UA}});
    const j=await r.json();
    return r.ok&&j.ok?{status:'ok',detail:'Responding'}:{status:'fail',detail:'HTTP '+r.status};
  });

  let page='';
  await add('Portal page',async()=>{
    const r=await fetch(base+'/',{signal:to(8000),headers:{'user-agent':UA}});
    page=await r.text();
    return r.ok&&page.includes('Raider Portal')?{status:'ok',detail:'HTTP '+r.status+', '+Math.round(page.length/1024)+' KB'}:{status:'fail',detail:'HTTP '+r.status};
  });

  await add('Script bundle',async()=>{
    const m=[...page.matchAll(/assets\/js\/[a-z0-9.]+\.js/g)].map(x=>x[0]);
    if(!m.length)return{status:'fail',detail:'No scripts referenced'};
    const sample=[m[0],m[Math.floor(m.length/2)],m[m.length-1]];
    const rs=await Promise.all(sample.map(p=>fetch(base+'/'+p,{signal:to(8000),headers:{'user-agent':UA}})));
    const bad=rs.filter(r=>!r.ok).length;
    return bad?{status:'fail',detail:bad+' of '+rs.length+' sampled scripts failed'}:{status:'ok',detail:m.length+' scripts referenced, sample loaded'};
  });

  await add('Security headers',async()=>{
    const r=await fetch(base+'/',{signal:to(8000),headers:{'user-agent':UA}});
    const need=['content-security-policy','strict-transport-security','x-frame-options','x-content-type-options','referrer-policy','permissions-policy'];
    const miss=need.filter(h=>!r.headers.get(h));
    return miss.length?{status:'warn',detail:'Missing: '+miss.join(', ')}:{status:'ok',detail:need.length+' of '+need.length+' present'};
  });

  await add('Deployment',async()=>({status:'ok',detail:[L.env.VERCEL_ENV,L.env.VERCEL_REGION,(L.env.VERCEL_GIT_COMMIT_SHA||'').slice(0,7),L.env.VERCEL_GIT_COMMIT_MESSAGE&&String(L.env.VERCEL_GIT_COMMIT_MESSAGE).slice(0,60)].filter(Boolean).join(' · ')||'No deployment info'}));

  L.send(res,200,{checks,time:new Date().toISOString()});
};
