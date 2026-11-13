const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..');
const pub=path.join(root,'public');
const rnd=n=>crypto.randomBytes(n);
const hex=n=>rnd(Math.ceil(n/2)).toString('hex').slice(0,n);
const words=['auth','sched','theme','core','ui','state','events','router','api','net','views','fx','storage','store','render','utils','audio','search','cache','input'];
const used=new Set();
const name=()=>{let n;do{n=words[rnd(1)[0]%words.length]+hex(3)}while(used.has(n));used.add(n);return n};
const fnv=b=>{let h=0x811c9dc5;for(const x of b){h^=x;h=Math.imul(h,0x01000193)>>>0}return h};

fs.rmSync(path.join(pub,'assets'),{recursive:true,force:true});
fs.mkdirSync(path.join(pub,'assets/js'),{recursive:true});
fs.mkdirSync(path.join(pub,'assets/data'),{recursive:true});

const html=fs.readFileSync(path.join(root,'src/app.html'));
const K=[...rnd(61)];
const enc=Buffer.alloc(html.length);
for(let i=0;i<html.length;i++)enc[i]=html[i]^K[i%61];
const b64=enc.toString('base64');
const CH=40,size=Math.ceil(b64.length/CH);
const parts=[];for(let i=0;i<b64.length;i+=size)parts.push(b64.slice(i,i+size));
const total=parts.reduce((a,p)=>a+p.length,0);
const sd=total%251+1;
const B=K.map((k,i)=>(k-sd*(i%7+1))&255);

const F=[],N=[];
const sri=buf=>'sha384-'+crypto.createHash('sha384').update(buf).digest('base64');
for(const p of parts){
  const n=name();
  const buf=Buffer.from('(self.__R=self.__R||{})["'+n+'"]="'+p+'";');
  const file='assets/js/'+n+'.'+crypto.createHash('sha1').update(buf).digest('hex').slice(0,6)+'.js';
  fs.writeFileSync(path.join(pub,file),buf);
  F.push([file,sri(buf)]);N.push(n);
}
for(let i=0;i<60;i++){
  const n=name();
  const buf=Buffer.from('(self.__D=self.__D||{})["'+n+'"]="'+rnd(2200+rnd(2)[0]*20+rnd(1)[0]*15).toString('base64')+'";');
  fs.writeFileSync(path.join(pub,'assets/js/'+n+'.'+crypto.createHash('sha1').update(buf).digest('hex').slice(0,6)+'.js'),buf);
}
for(let i=0;i<30;i++){
  const n=name();
  const buf=Buffer.from(rnd(2000+rnd(2)[0]*20+rnd(1)[0]*12).toString('base64'));
  fs.writeFileSync(path.join(pub,'assets/data/'+n+'.'+crypto.createHash('sha1').update(buf).digest('hex').slice(0,6)+'.bin'),buf);
}

const stub=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>Raider Portal</title><style>html,body{background:#08080d;margin:0}</style></head><body><script>
(function(){var h=location.hostname.toLowerCase(),A=["vercel.app","github.io"],ok=false;for(var i=0;i<A.length;i++){if(h===A[i]||h.slice(-(A[i].length+1))==="."+A[i])ok=true}
if(!ok||window.top!==window.self){document.documentElement.innerHTML="";throw new Error("blocked")}})();
(function(){var F=${JSON.stringify(F)},N=${JSON.stringify(N)},i=0,cd=false,cw=null;
function cfgDone(){cd=true;if(cw){var f=cw;cw=null;f()}}
function ready(f){if(cd)f();else cw=f}
setTimeout(cfgDone,2500);
try{fetch("/api/config",{credentials:"omit",cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&typeof j==="object"&&!Array.isArray(j))window.__CFG=j}).catch(function(){}).then(cfgDone)}catch(e){cfgDone()}
function nx(){if(i<F.length){var s=document.createElement("script");var e=F[i++];s.src=e[0];s.integrity=e[1];s.crossOrigin="anonymous";s.onload=nx;s.onerror=function(){document.body.textContent="Could not load. Please refresh."};document.body.appendChild(s)}else ready(go)}
function go(){try{(
function(P){var T=P.length,total=0;for(var q=0;q<P.length;q++)total+=P[q].length;
var B=${JSON.stringify(B)},sd=total%251+1,K=[];for(var i=0;i<61;i++)K.push((B[i]+sd*(i%7+1))&255);
var s=atob(P.join('')),u=new Uint8Array(s.length),h=0x811c9dc5;
for(var i=0;i<s.length;i++){u[i]=s.charCodeAt(i)^K[i%61];}
for(var i=0;i<u.length;i++){h^=u[i];h=Math.imul(h,0x01000193)>>>0}
if(h!==${fnv(html)})throw 0;
var out=new TextDecoder('utf-8').decode(u);document.open();document.write(out);document.close();}
)(N.map(function(n){return self.__R[n]}))}catch(e){document.body.textContent="Could not load. Please refresh."}}nx()})();
</script></body></html>`;
fs.writeFileSync(path.join(pub,'index.html'),stub);

const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'schema.json'),'utf8'));
fs.writeFileSync(path.join(root,'api/_schema.json'),JSON.stringify(schema));
const admin=fs.readFileSync(path.join(__dirname,'admin.html'),'utf8').replace('__SCHEMA__',()=>JSON.stringify(schema).replace(/</g,'\\u003c'));
fs.writeFileSync(path.join(pub,'admin.html'),admin);
console.log('built',F.length,'chunks, decoys 90, html',html.length,'bytes');
