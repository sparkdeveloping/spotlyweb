import { redirect } from "next/navigation";
import { SimpleBusinessRegistration } from "@/components/simple-business-registration";
export const metadata={title:"Get started · Spotly Business",description:"Register interest in Spotly Business",robots:{index:false,follow:false}};
export default async function GetStartedPage({searchParams}){
 const params=await searchParams;
 if(params?.draft || params?.business || params?.invite || params?.verify === "1" || params?.new === "1"){
   const query=new URLSearchParams();for(const key of ["draft","business","invite","new","name"]){if(typeof params?.[key]==="string")query.set(key,params[key]);}
   redirect("/get-started/verify"+(query.size?"?"+query.toString():""));
 }
 return <SimpleBusinessRegistration initialName={String(params?.name||"").slice(0,180)}/>;
}
