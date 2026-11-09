import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { SERVICE_AVAILABILITY_STATES, SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION } from "@/lib/service-availability-generated";
import { SERVICE_AVAILABILITY_CONTROL_PLANE_VERSION } from "@/lib/service-availability-control-plane";
import {
  editServiceAvailabilityDraft,
  loadServiceAvailabilityControlPlane,
  publicControlPlanePayload,
  publishServiceAvailabilityDraft,
  resetServiceAvailabilityDraft,
  rollbackServiceAvailability
} from "@/lib/service-availability-control-plane-server";

export const runtime = "nodejs";

const READ_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager", "regional_operations_manager", "driver_operations_coordinator"];
const WRITE_ROLES = ["super_admin", "admin", "platform_admin", "operations_manager"];

const editSchema = z.object({
  action: z.literal("edit").optional(),
  service: z.string().min(2).max(30),
  scope: z.enum(["service", "country", "city"]),
  state: z.enum(["hidden", "preview", "discover", "live", "paused", "inherit"]).optional(),
  inherit: z.boolean().optional(),
  country: z.string().max(2).optional(),
  city: z.string().max(120).optional(),
  reason: z.string().max(300).optional()
}).strict();

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_draft") }).strict(),
  z.object({ action: z.literal("publish"), note: z.string().max(500).optional() }).strict(),
  z.object({ action: z.literal("rollback"), revisionId: z.string().min(8).max(160), note: z.string().max(500).optional() }).strict()
]);

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: READ_ROLES });
    const { db } = getAdminServices();
    const control = await loadServiceAvailabilityControlPlane(db);
    return Response.json({
      ok: true,
      controlPlaneVersion: SERVICE_AVAILABILITY_CONTROL_PLANE_VERSION,
      contractVersion: SPOTLY_SERVICE_AVAILABILITY_CONTRACT_VERSION,
      states: SERVICE_AVAILABILITY_STATES,
      ...publicControlPlanePayload(control)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request, { roles: WRITE_ROLES });
    const raw = await request.json();
    const { db } = getAdminServices();

    if (!raw?.action || raw.action === "edit") {
      const input = editSchema.parse(raw || {});
      await editServiceAvailabilityDraft(db, actor, {
        service: input.service,
        scope: input.scope,
        state: input.state,
        inherit: input.inherit === true || input.state === "inherit",
        country: input.country,
        city: input.city,
        reason: input.reason || ""
      });
      const control = await loadServiceAvailabilityControlPlane(db);
      return Response.json({ ok: true, action: "edit", ...publicControlPlanePayload(control) });
    }

    const input = actionSchema.parse(raw);
    if (input.action === "reset_draft") {
      await resetServiceAvailabilityDraft(db, actor);
      const control = await loadServiceAvailabilityControlPlane(db);
      return Response.json({ ok: true, action: input.action, ...publicControlPlanePayload(control) });
    }
    if (input.action === "publish") {
      const published = await publishServiceAvailabilityDraft(db, actor, { note: input.note || "" });
      const control = await loadServiceAvailabilityControlPlane(db);
      return Response.json({ ok: true, action: input.action, published, ...publicControlPlanePayload(control) });
    }
    const published = await rollbackServiceAvailability(db, actor, { revisionId: input.revisionId, note: input.note || "" });
    const control = await loadServiceAvailabilityControlPlane(db);
    return Response.json({ ok: true, action: input.action, published, ...publicControlPlanePayload(control) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Countries & Services change before continuing." }, { status: 422 });
    return apiError(error);
  }
}
