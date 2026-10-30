/** Presentation only. Internal service IDs and canonical product routes are unchanged. */
export const SERVICE_IDENTITIES = Object.freeze({
  eat: { asset: "bite", name: "Spotly Bite", label: "Bite", action: "Explore food", detail: "A little more delicious.", color: "#FF8A00" },
  shop: { asset: "shopper", name: "Spotly Shopper", label: "Shopper", action: "Explore shops", detail: "Good finds. Close by.", color: "#10C981" },
  ride: { asset: "ride", name: "Spotly Ride", label: "Ride", action: "Plan a ride", detail: "Your next move, made easier.", color: "#2F80FF" },
  send: { asset: "send", name: "Spotly Send", label: "Send", action: "Explore Send", detail: "From here to their hands.", color: "#A855F7" },
  book: { asset: "book", name: "Spotly Book", label: "Book", action: "Explore services", detail: "Make room for yourself.", color: "#7C3AED" },
  events: { asset: "live", name: "Spotly Live", label: "Live", action: "Explore events", detail: "Be part of the moment.", color: "#FF2D6F" }
});

export function serviceIdentity(service) {
  return SERVICE_IDENTITIES[service] || SERVICE_IDENTITIES.eat;
}
