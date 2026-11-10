import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const ios=(path)=>readFileSync(new URL(`../../../ios/spotly/spotly/${path}`,import.meta.url),"utf8");

test("Phase 19 web Activity uses one canonical feed across every customer service",()=>{
  const app=read("components/marketplace-app.js");
  const route=read("app/api/customer/activity/route.js");
  assert.match(app,/\/api\/customer\/activity/);
  assert.doesNotMatch(app,/subscribeCustomerOrders/);
  assert.doesNotMatch(app,/AssistActivitySection/);
  for(const token of ['"ride"','"send"','"assist_shopping"','"assist_booking"']) assert.ok(route.includes(token),token);
  for(const collection of ["orders","rideTrips","parcelJobs","independentShoppingRequests","assistedBookings"]) assert.ok(route.includes(collection),collection);
  assert.match(route,/transactionType: kind/);
  assert.match(route,/customerRating/);
});

test("Phase 19 ordinary Bite and Shopper history retains fulfilment detail instead of rendering as Book",()=>{
  const app=read("components/marketplace-app.js");
  const summary=read("components/customer-conversion.js");
  const route=read("app/api/customer/activity/route.js");
  assert.match(app,/specialTransaction = \["ride", "send", "appointment", "booking", "ticket"\]/);
  assert.match(summary,/if \(!\["ride", "send", "appointment", "booking", "ticket"\]\.includes\(kind\)\) return null/);
  for(const token of ["delivery: order.delivery","pickup: order.pickup","branchName:","country:","timeZone:"]) assert.ok(route.includes(token),token);
});

test("Phase 19 reviews and cancellations route to the real service domain",()=>{
  const app=read("components/marketplace-app.js");
  const sendRating=read("app/api/customer/parcels/rating/route.js");
  assert.match(app,/\/api\/customer\/rides\/rating/);
  assert.match(app,/\/api\/customer\/parcels\/rating/);
  assert.match(app,/\/api\/customer\/rides"/);
  assert.match(app,/\/api\/customer\/parcels"/);
  assert.match(sendRating,/\["delivered", "returned"\]/);
  assert.match(sendRating,/ratingTotal/);
});

test("Phase 19 customer notification preferences are one shared four-domain contract",()=>{
  const account=read("components/account-app.js");
  const dispatcher=read("lib/notification-server.js");
  for(const token of ["orderUpdates","bookingUpdates","rideSendUpdates","marketing"]) assert.ok(account.includes(token),token);
  assert.doesNotMatch(account,/businessUpdates/);
  assert.doesNotMatch(account,/workUpdates/);
  assert.match(dispatcher,/preferenceKeyForNotification/);
  assert.match(dispatcher,/rideSendUpdates/);
  assert.match(dispatcher,/bookingUpdates/);
  assert.match(dispatcher,/orderUpdates/);
  assert.match(dispatcher,/preferences\.marketing === true/);
});

test("Phase 19 account deletion sees all service and Assist blockers",()=>{
  const route=read("app/api/customer/account/deletion/route.js");
  for(const collection of ["rideTrips","parcelJobs","orders","independentShoppingRequests","assistedBookings"]) assert.ok(route.includes(collection),collection);
  assert.match(route,/export async function GET/);
  assert.match(route,/activeAssistShoppingCount/);
  assert.match(route,/activeAssistBookingCount/);
  assert.match(route,/blockers\.total/);
});

test("Phase 19 support is a persistent customer conversation system",()=>{
  const route=read("app/api/support/conversations/route.js");
  const profile=ios("Features/Production/ProfileSupportNotifications.swift");
  assert.match(route,/export async function GET/);
  assert.match(route,/where\("requesterId", "==", user\.uid\)/);
  assert.match(route,/where\("conversationId", "==", conversationId\)/);
  assert.match(profile,/struct SupportInboxView/);
  assert.match(profile,/struct SupportConversationView/);
  assert.match(profile,/sendSupportMessage/);
});

test("Phase 19 iOS referrals are first-class and deep-linkable",()=>{
  const profile=ios("Features/Production/ProfileSupportNotifications.swift");
  const links=ios("Core/Navigation/DeepLinkCoordinator.swift");
  const destination=ios("Features/Production/DeepLinkDestinationView.swift");
  assert.match(profile,/struct ReferralView/);
  assert.match(profile,/ShareLink/);
  assert.match(profile,/claimReferral/);
  assert.match(links,/case referrals\(String\?\)/);
  assert.match(links,/query\["code"\]/);
  assert.match(destination,/ReferralView\(initialCode: code\)/);
});

test("Phase 19 notification and support deep links preserve exact customer context",()=>{
  const profile=ios("Features/Production/ProfileSupportNotifications.swift");
  const links=ios("Core/Navigation/DeepLinkCoordinator.swift");
  assert.match(profile,/markAllNotificationsRead/);
  assert.match(links,/case support\(String\?\)/);
  assert.match(links,/query\["conversation"\]/);
});

test("Phase 19 Saved places retain their full address on iOS",()=>{
  const firestore=ios("Core/Network/FirestoreREST.swift");
  const store=ios("Core/Stores/SavedStore.swift");
  assert.match(firestore,/"address": item\.address \?\? ""/);
  assert.match(store,/address: doc\.fields\["address"\]/);
});

test("Phase 19 completed Ride and Send can rate the actual Driver from iOS Activity",()=>{
  const tracking=ios("Features/Production/OperationalTrackingViews.swift");
  const services=ios("Core/Services/ProductionServices.swift");
  const models=ios("Core/Models/Production/TransactionModels.swift");
  assert.match(tracking,/Rate your Driver/);
  assert.match(tracking,/Rate your courier/);
  assert.match(services,/\/api\/customer\/rides\/rating/);
  assert.match(services,/\/api\/customer\/parcels\/rating/);
  assert.match(models,/riderRating: Int\?/);
  assert.match(models,/customerRating: Int\?/);
});

test("Phase 19 historical Activity is not hidden when a service is later disabled",()=>{
  const route=read("app/api/customer/activity/route.js");
  assert.doesNotMatch(route,/requireServiceLive|resolveServiceAvailability|transactionsEnabled/);
  assert.match(route,/db\.collection\("orders"\)/);
  assert.match(route,/db\.collection\("rideTrips"\)/);
  assert.match(route,/db\.collection\("parcelJobs"\)/);
});
