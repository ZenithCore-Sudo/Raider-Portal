const L=require('./_lib');
module.exports=async(req,res)=>{
  if(req.method!=='GET'){L.send(res,405,{error:'method'});return}
  L.send(res,200,{ok:true,time:new Date().toISOString()});
};
