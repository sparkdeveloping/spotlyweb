import crypto from "node:crypto";
import { z } from "zod";
import { apiError } from "@/lib/firebase-admin";
import { authenticateKiosk } from "@/lib/kiosk-server";
export const runtime = "nodejs";
const schema = z.object({ pin: z.string().max(20).default("") });
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
export async function POST(request) {
  try {
    const device = await authenticateKiosk(request);
    const body = schema.parse(await request.json());
    if (device.requireExitPin && (!device.exitPinHash || hash(body.pin) !== device.exitPinHash)) throw Object.assign(new Error("That staff PIN is not correct."), { status: 403 });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
