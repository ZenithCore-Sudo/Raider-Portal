const L=require('../_lib');
module.exports=async(req,res)=>{
  if(!L.guard(req,res,{method:'GET'}))return;
  if(!L.ready()){L.send(res,503,{error:'GITHUB_REPO and GITHUB_TOKEN are not set'});return}
  try{
    const f=await L.readFile();
    const r=await L.gh('/repos/'+L.REPO+'/commits?path='+encodeURIComponent(L.FILE)+'&sha='+encodeURIComponent(L.BRANCH)+'&per_page=30');
    const commits=r.ok?(await r.json()).map(c=>({sha:c.sha,message:String(c.commit.message).split('\n')[0],date:c.commit.committer.date})):[];
    L.send(res,200,{config:f.data.config,presets:f.data.presets,sha:f.sha,commits});
  }catch(e){L.send(res,502,{error:String(e.message)})}
};
