import "server-only";

import { CAREER_OPENINGS, careerOpeningById } from "@/data/careers";

function timestamp(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeCareerJob(id, data = {}) {
  const base = careerOpeningById(id) || {};
  return {
    ...base,
    ...data,
    id,
    responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : (base.responsibilities || []),
    requirements: Array.isArray(data.requirements) ? data.requirements : (base.requirements || []),
    niceToHave: Array.isArray(data.niceToHave) ? data.niceToHave : (base.niceToHave || []),
    status: data.status || base.status || "draft",
    createdAt: timestamp(data.createdAt) || base.createdAt || null,
    updatedAt: timestamp(data.updatedAt) || base.updatedAt || null
  };
}

export async function listCareerJobs(db, { includeUnpublished = false } = {}) {
  const map = new Map(CAREER_OPENINGS.map((item) => [item.id, normalizeCareerJob(item.id, item)]));
  const snapshot = await db.collection("careerJobs").get();
  snapshot.docs.forEach((doc) => map.set(doc.id, normalizeCareerJob(doc.id, doc.data())));
  return [...map.values()]
    .filter((job) => includeUnpublished || job.status === "published")
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.department.localeCompare(b.department) || a.title.localeCompare(b.title));
}

export async function getCareerJob(db, id, { includeUnpublished = false } = {}) {
  const snapshot = await db.collection("careerJobs").doc(id).get();
  const job = snapshot.exists ? normalizeCareerJob(id, snapshot.data()) : normalizeCareerJob(id, careerOpeningById(id) || {});
  if (!job.title || (!includeUnpublished && job.status !== "published")) return null;
  return job;
}

export function publicCareerJob(job) {
  return {
    id: job.id,
    title: job.title,
    department: job.department,
    location: job.location,
    arrangement: job.arrangement,
    employmentType: job.employmentType,
    summary: job.summary,
    description: job.description,
    responsibilities: job.responsibilities || [],
    requirements: job.requirements || [],
    niceToHave: job.niceToHave || [],
    featured: Boolean(job.featured),
    status: job.status
  };
}

export function staffCareerJob(job) {
  return { ...publicCareerJob(job), rolePackId: job.rolePackId || "", createdAt: job.createdAt || null, updatedAt: job.updatedAt || null };
}
