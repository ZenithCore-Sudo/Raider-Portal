const L=require('./_lib');
let cache=null,at=0;
module.exports=async(req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){L.send(res,405,{error:'method'});return}
  let cfg={};
  try{
    if(L.ready()){
      if(!cache||Date.now()-at>10000){cache=(await L.readFile()).data.config;at=Date.now()}
      cfg=cache;
    }
  }catch(e){cfg=cache||{}}
  L.send(res,200,cfg,{'Cache-Control':'public, s-maxage=10, stale-while-revalidate=60','X-Content-Type-Options':'nosniff'});
};
