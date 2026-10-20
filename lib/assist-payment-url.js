/** Reject payment-provider URL substitution and server-side polling of foreign hosts. */
export function trustedPaynowUrl(raw, {kind="poll"}={}){
 try{
  const url=new URL(String(raw||""));
  if(url.protocol!=="https:"||url.username||url.password||url.port)return false;
  const host=url.hostname.toLowerCase();
  if(host!=="paynow.co.zw"&&!host.endsWith(".paynow.co.zw"))return false;
  if(kind==="poll"&&!/^\/interface\/checkpayment\/?/i.test(url.pathname))return false;
  return true;
 }catch{return false;}
}
