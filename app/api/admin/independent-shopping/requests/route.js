import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";

export const runtime = "nodejs";
const roles = ["super_admin", "platform_admin", "operations_manager"];

export async function GET(request) {
  try {
    await authenticateRequest(request, { roles });
    const { db } = getAdminServices();
    const requests = await db.collection("independentShoppingRequests").limit(100).get();
    return Response.json({
      ok: true,
      requests: requests.docs.map((doc) => {
        const entry = doc.data();
        return {
          id: doc.id,
          storeId: entry.storeId, storeName: entry.storeName,
          state: entry.state,
          contactName: entry.contactName, contactPhone: entry.contactPhone,
          deliveryAddress: entry.deliveryAddress, notes: entry.notes,
          items: entry.items || [], collectionAddress: entry.collectionAddress || "", sourceBusinessId: entry.sourceBusinessId || "",
          estimate: entry.estimate, finalQuote: entry.finalQuote || null, customerMessage: entry.customerMessage || "",
          createdAt: entry.createdAt?.toDate?.()?.toISOString?.() || null,
          paymentStatus: entry.paymentStatus, dispatchStatus: entry.dispatchStatus,
          quoteExpired:Boolean(entry.state==="quote_offered" && entry.finalQuote?.expiresAt && Date.parse(entry.finalQuote.expiresAt)<=Date.now()),
          requiresPaymentSetup:entry.state==="quote_accepted_awaiting_payment"
        };
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
