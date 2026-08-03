import { getFirebaseClient } from "@/lib/firebase";

export async function authenticatedFetch(url, options = {}) {
  const client = getFirebaseClient();
  const user = client?.auth.currentUser;
  if (!user) throw new Error("Sign in to continue.");
  const token = await user.getIdToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}
