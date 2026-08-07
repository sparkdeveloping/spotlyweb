"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { getFirebaseClient } from "@/lib/firebase";
import { normalizeSearchTerms, writeClientTelemetry } from "@/lib/firebase-services";

function sdk() {
  const client = getFirebaseClient();
  if (!client) throw new Error("Firebase is not configured in this browser.");
  return client;
}

function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)]));
  }
  return value;
}

function records(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function subscribeList(collectionName, callback, onError, filters = []) {
  const { db } = sdk();
  const constraints = filters.filter(Boolean).map(([field, operator, value]) => where(field, operator, value));
  const source = constraints.length ? query(collection(db, collectionName), ...constraints) : collection(db, collectionName);
  return onSnapshot(source, (snapshot) => callback(records(snapshot)), onError);
}

export function subscribeStaffProfile(userId, callback, onError) {
  if (!userId) return () => {};
  const { db } = sdk();
  return onSnapshot(doc(db, "staffProfiles", userId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function subscribeStaffDirectory(callback, onError) {
  return subscribeList("staffProfiles", callback, onError);
}

export function subscribeStaffTasks(callback, options = {}) {
  const filters = [];
  if (options.assigneeId) filters.push(["assigneeId", "==", options.assigneeId]);
  if (options.department) filters.push(["department", "==", options.department]);
  return subscribeList("staffTasks", callback, options.onError, filters);
}

export function subscribeStaffShifts(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffShifts", callback, options.onError, filters);
}

export function subscribeLeaveRequests(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffLeaveRequests", callback, options.onError, filters);
}

export function subscribeTrainingAssignments(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffTrainingAssignments", callback, options.onError, filters);
}

export function subscribeStaffAssets(callback, options = {}) {
  const filters = options.userId ? [["assignedTo", "==", options.userId]] : [];
  return subscribeList("staffAssets", callback, options.onError, filters);
}

export function subscribePerformanceRecords(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffPerformance", callback, options.onError, filters);
}

export function subscribePayrollRecords(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffPayrollRecords", callback, options.onError, filters);
}

export function subscribeWorkforceRequests(callback, onError) {
  return subscribeList("workforceRequests", callback, onError);
}

export function subscribeCandidates(callback, onError) {
  return subscribeList("staffCandidates", callback, onError);
}

export function subscribeStaffSupportRequests(callback, options = {}) {
  const filters = options.userId ? [["userId", "==", options.userId]] : [];
  return subscribeList("staffSupportRequests", callback, options.onError, filters);
}

export async function saveStaffProfile(values, actor) {
  const { db } = sdk();
  const id = values.id || values.userId;
  if (!id) throw new Error("A linked Spotly account is required for a staff record.");
  const payload = clean({
    ...values,
    userId: id,
    displayName: values.displayName || values.fullName || values.email || "Spotly staff member",
    searchTerms: normalizeSearchTerms(values.displayName, values.fullName, values.email, values.employeeNumber, values.department, values.roleTitle),
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null
  });
  await setDoc(doc(db, "staffProfiles", id), payload, { merge: true });
  await writeClientTelemetry({ action: "staff.profile_saved", entityType: "staffProfiles", entityId: id, actorId: actor?.uid, actorEmail: actor?.email });
  return id;
}

export async function saveStaffTask(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, status: values.status || "open", updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  if (values.id) await setDoc(doc(db, "staffTasks", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffTasks"), { ...payload, createdAt: serverTimestamp(), createdBy: actor?.uid || null });
    values.id = result.id;
  }
  await writeClientTelemetry({ action: "staff.task_saved", entityType: "staffTasks", entityId: values.id, actorId: actor?.uid, actorEmail: actor?.email });
  return values.id;
}

export async function updateStaffTask(id, changes, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "staffTasks", id), clean({ ...changes, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null }));
  await writeClientTelemetry({ action: "staff.task_updated", entityType: "staffTasks", entityId: id, metadata: changes, actorId: actor?.uid, actorEmail: actor?.email });
}

export async function saveStaffShift(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  if (values.id) await setDoc(doc(db, "staffShifts", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffShifts"), { ...payload, createdAt: serverTimestamp() });
    values.id = result.id;
  }
  await writeClientTelemetry({ action: "staff.shift_saved", entityType: "staffShifts", entityId: values.id, actorId: actor?.uid, actorEmail: actor?.email });
  return values.id;
}

export async function clockStaffShift(shiftId, action, actor) {
  const { db } = sdk();
  const changes = action === "in"
    ? { status: "in_progress", clockedInAt: serverTimestamp(), clockedInBy: actor?.uid || null }
    : { status: "completed", clockedOutAt: serverTimestamp(), clockedOutBy: actor?.uid || null };
  await updateDoc(doc(db, "staffShifts", shiftId), changes);
  await writeClientTelemetry({ action: `staff.clock_${action}`, entityType: "staffShifts", entityId: shiftId, actorId: actor?.uid, actorEmail: actor?.email });
}

export async function saveLeaveRequest(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, userId: values.userId || actor?.uid, status: values.status || "pending", updatedAt: serverTimestamp() });
  if (values.id) await setDoc(doc(db, "staffLeaveRequests", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffLeaveRequests"), { ...payload, createdAt: serverTimestamp(), submittedBy: actor?.uid || null });
    values.id = result.id;
  }
  await writeClientTelemetry({ action: "staff.leave_saved", entityType: "staffLeaveRequests", entityId: values.id, actorId: actor?.uid, actorEmail: actor?.email });
  return values.id;
}

export async function decideLeaveRequest(id, status, reason, actor) {
  const { db } = sdk();
  await updateDoc(doc(db, "staffLeaveRequests", id), clean({ status, decisionReason: reason || "", decidedAt: serverTimestamp(), decidedBy: actor?.uid || null, updatedAt: serverTimestamp() }));
  await writeClientTelemetry({ action: `staff.leave_${status}`, entityType: "staffLeaveRequests", entityId: id, metadata: { reason }, actorId: actor?.uid, actorEmail: actor?.email });
}

export async function saveWorkforceRequest(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, status: values.status || "draft", requestedBy: values.requestedBy || actor?.uid || null, updatedAt: serverTimestamp() });
  if (values.id) await setDoc(doc(db, "workforceRequests", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "workforceRequests"), { ...payload, createdAt: serverTimestamp() });
    values.id = result.id;
  }
  await writeClientTelemetry({ action: "staff.workforce_request_saved", entityType: "workforceRequests", entityId: values.id, actorId: actor?.uid, actorEmail: actor?.email });
  return values.id;
}

export async function saveCandidate(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, status: values.status || "applied", searchTerms: normalizeSearchTerms(values.fullName, values.email, values.phone, values.roleTitle), updatedAt: serverTimestamp() });
  if (values.id) await setDoc(doc(db, "staffCandidates", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffCandidates"), { ...payload, createdAt: serverTimestamp(), createdBy: actor?.uid || null });
    values.id = result.id;
  }
  await writeClientTelemetry({ action: "staff.candidate_saved", entityType: "staffCandidates", entityId: values.id, actorId: actor?.uid, actorEmail: actor?.email });
  return values.id;
}

export async function saveTrainingAssignment(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, status: values.status || "assigned", updatedAt: serverTimestamp() });
  if (values.id) await setDoc(doc(db, "staffTrainingAssignments", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffTrainingAssignments"), { ...payload, createdAt: serverTimestamp(), assignedBy: actor?.uid || null });
    values.id = result.id;
  }
  return values.id;
}

export async function savePerformanceRecord(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  if (values.id) await setDoc(doc(db, "staffPerformance", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffPerformance"), { ...payload, createdAt: serverTimestamp() });
    values.id = result.id;
  }
  return values.id;
}

export async function saveStaffAsset(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, status: values.status || "assigned", updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  if (values.id) await setDoc(doc(db, "staffAssets", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffAssets"), { ...payload, createdAt: serverTimestamp() });
    values.id = result.id;
  }
  return values.id;
}

export async function savePayrollRecord(values, actor) {
  const { db } = sdk();
  const payload = clean({ ...values, updatedAt: serverTimestamp(), updatedBy: actor?.uid || null });
  if (values.id) await setDoc(doc(db, "staffPayrollRecords", values.id), payload, { merge: true });
  else {
    const result = await addDoc(collection(db, "staffPayrollRecords"), { ...payload, createdAt: serverTimestamp() });
    values.id = result.id;
  }
  return values.id;
}

export async function saveStaffSupportRequest(values, actor) {
  const { db } = sdk();
  const result = await addDoc(collection(db, "staffSupportRequests"), clean({ ...values, userId: values.userId || actor?.uid, status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await writeClientTelemetry({ action: "staff.support_requested", entityType: "staffSupportRequests", entityId: result.id, actorId: actor?.uid, actorEmail: actor?.email });
  return result.id;
}
