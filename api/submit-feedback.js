const{TELEGRAM_BOT_TOKEN,TELEGRAM_CHAT_ID}=process.env;
const allowedOrigins=['https://outparse.github.io','https://outparse-app.github.io'];
export default async function handler(req,res){
const origin=req.headers.origin;
if(allowedOrigins.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);}
else if(origin){return res.status(403).json({error:'Origin not allowed'});}
res.setHeader('Access-Control-Allow-Methods','POST');
res.setHeader('Access-Control-Allow-Headers','Content-Type');
if(req.method==='OPTIONS'){return res.status(200).end();}
if(req.method!=='POST'){return res.status(405).json({message:'Method not allowed'});}
try{
const{rating,feedback,timestamp}=req.body;
const message=`📢 New Feedback Received:\n\n⭐ Rating: ${rating}/5\n📝 Feedback: ${feedback}\n⏰ Timestamp: ${new Date(timestamp).toLocaleString()}`;
const telegramResponse=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TELEGRAM_CHAT_ID,text:message,parse_mode:'Markdown'})});
if(!telegramResponse.ok){throw new Error('Failed to send to Telegram');}
return res.status(200).json({success:true});
}catch(error){
console.error('Error:',error);
return res.status(500).json({error:'Internal server error'});
}
}
