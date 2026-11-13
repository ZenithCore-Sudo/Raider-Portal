const L=require('../_lib');
module.exports=async(req,res)=>{
  if(!L.guard(req,res,{method:'POST',open:true}))return;
  if(!L.env.ADMIN_PASSWORD||!L.env.SESSION_SECRET){L.send(res,503,{error:'not configured'});return}
  if(L.throttled(req)){L.send(res,429,{error:'too many attempts'});return}
  if(!L.sameOrigin(req)){L.send(res,403,{error:'forbidden'});return}
  const p=L.body(req).password;
  if(typeof p==='string'&&p.length<=200&&L.safeEq(p,L.env.ADMIN_PASSWORD)){
    L.clearFail(req);
    L.send(res,200,{ok:true},{'Set-Cookie':L.cookie(L.makeToken(),8*3600)});
    return;
  }
  L.noteFail(req);
  await new Promise(r=>setTimeout(r,700));
  L.send(res,401,{error:'wrong password'});
};
