import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
function selectionHandler(sourceText){
 const start=sourceText.indexOf("function LocationSearch(");
 const end=sourceText.indexOf("function ",start+12);
 assert.ok(start>=0&&end>start,"LocationSearch component must be present");
 return sourceText.slice(start,end);
}
test("Ride address suggestion saves verified coordinates after changing visible text",()=>{
 const ui=selectionHandler(source("components/ride-app.js"));
 const click=ui.slice(ui.indexOf("onClick={() => { onChange(item.label);"));
 assert.ok(click.startsWith("onClick={() => { onChange(item.label); onSelect({ lat: item.lat, lng: item.lng"));
 assert.ok(ui.includes("Location confirmed for fare calculation"));
 assert.ok(ui.includes("setSearchError(error?.message"));
 assert.ok(ui.includes("active=false"));
 const form=source("components/ride-app.js");
 assert.ok(form.includes("disabled={!pickup || !dropoff}"));
});
test("Send address suggestion also retains point coordinates and surfaces search failures",()=>{
 const ui=selectionHandler(source("components/send-app.js"));
 assert.ok(ui.includes('onClick={()=>{onChange(item.label);onSelect({lat:item.lat'));
 assert.ok(ui.includes("Location confirmed for delivery estimate"));
 assert.ok(ui.includes("setSearchError(error?.message"));
 assert.ok(ui.includes("active=false"));
});
test("Selected coordinate survives the parent text-change clearing handler",()=>{
 const option={lat:-17.83,lng:31.05,formattedAddress:"Mount Pleasant, Harare, Zimbabwe"};
 let address="",point=null;
 const onChange=value=>{address=value;if(value!==point?.formattedAddress)point=null;};
 const onSelect=value=>{point=value;};
 // This is the required callback sequence in both Ride and Send location suggestions.
 onChange(option.formattedAddress);
 onSelect(option);
 assert.equal(address,option.formattedAddress);
 assert.deepEqual(point,option);
 assert.ok(point.lat&&point.lng);
});
