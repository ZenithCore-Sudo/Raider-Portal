const L=require('../_lib');
module.exports=async(req,res)=>{
  if(!L.guard(req,res,{method:'POST',write:true,open:true}))return;
  L.send(res,200,{ok:true},{'Set-Cookie':L.cookie('',0)});
};
