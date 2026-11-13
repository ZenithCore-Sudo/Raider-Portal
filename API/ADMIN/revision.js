const L=require('../_lib');
module.exports=async(req,res)=>{
  if(!L.guard(req,res,{method:'GET'}))return;
  const ref=String((req.query&&req.query.ref)||'');
  if(!/^[0-9a-f]{40}$/.test(ref)){L.send(res,400,{error:'bad ref'});return}
  try{L.send(res,200,{config:(await L.readFile(ref)).data.config})}catch(e){L.send(res,502,{error:String(e.message)})}
};
