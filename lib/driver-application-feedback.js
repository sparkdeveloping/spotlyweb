/** Driver application submission feedback shared by API and Driver UI.
 * Never includes document contents, payout identifiers, or private records.
 */
const stepLookup={
 identity:0,work:1,vehicle:1,payout:4,agreements:5
};
export const DRIVER_APPLICATION_STEP_LABELS=[
 "Your details","Work & vehicle","Documents","Work areas","Getting paid","Training & review"
];
export function driverBlockerStep(id=""){
 const key=String(id);
 if(key.startsWith("document_"))return 2;
 if(key.startsWith("training_"))return 5;
 return stepLookup[key]??5;
}
export function safeDriverBlockers(checks){
 if(!Array.isArray(checks))return [];
 return checks.filter(check=>check&&check.ok===false&&typeof check.id==="string")
   .slice(0,24).map(check=>({
     ok:false,
     id:String(check.id).slice(0,90),
     label:String(check.label||"Incomplete requirement").slice(0,130),
     step:driverBlockerStep(check.id),
     status:typeof check.status==="string"?String(check.status).slice(0,50):undefined
   }));
}
export function driverBlockerHelp(item){
 if(!item)return "Review this requirement.";
 if(item.id==="identity")return "Confirm your full name, complete phone number and city.";
 if(item.id==="work")return "Select at least one kind of work your vehicle can perform.";
 if(item.id==="vehicle")return "Complete your vehicle details and registration, if required.";
 if(item.id==="payout")return "Add and save a payout account or mobile-money wallet.";
 if(item.id==="agreements")return "Accept both Driver terms and location-use consent.";
 if(item.id.startsWith("training_"))return "Finish the required training module and its comprehension check.";
 if(item.id.startsWith("document_")){
   if(item.status==="expired")return "Upload a current document; the previous one has expired.";
   if(item.status==="rejected")return "Replace the rejected document and check its review feedback.";
   return "Upload the required document for your selected vehicle and work.";
 }
 return "Review this section and save the missing details.";
}
