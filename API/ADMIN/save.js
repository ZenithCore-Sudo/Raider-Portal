const L=require('../_lib');
module.exports=async(req,res)=>{
  if(!L.guard(req,res,{method:'POST',write:true}))return;
  if(!L.ready()){L.send(res,503,{error:'not configured'});return}
  const b=L.body(req);
  try{
    const data={config:L.clean(b.config),presets:L.cleanPresets(b.presets)};
    const r=await L.writeFile(data,typeof b.sha==='string'?b.sha:null,'admin: '+(b.message||'update settings'));
    if(r.conflict){L.send(res,409,{error:'The settings changed somewhere else. Reload and try again.'});return}
    L.send(res,200,{ok:true,sha:r.sha,config:data.config,presets:data.presets});
  }catch(e){L.send(res,502,{error:String(e.message)})}
};
