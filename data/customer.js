export const customerCategories = [
  { id: "restaurants", name: "Food", emoji: "🍽️", count: 126, tint: "#FFF1E8" },
  { id: "groceries", name: "Groceries", emoji: "🛒", count: 42, tint: "#EAF8EF" },
  { id: "events", name: "Events", emoji: "🎟️", count: 31, tint: "#FFF5D8" },
  { id: "beauty", name: "Beauty", emoji: "✨", count: 58, tint: "#FBEAF6" },
  { id: "wellness", name: "Wellness", emoji: "🧘", count: 37, tint: "#EAF6FF" },
  { id: "activities", name: "Activities", emoji: "🧗", count: 49, tint: "#F2EDFF" },
  { id: "health", name: "Health", emoji: "🩺", count: 24, tint: "#EAF8F7" },
  { id: "gifts", name: "Gifts", emoji: "🎁", count: 33, tint: "#FFF0F2" }
];

export const places = [
  {
    id: "namaste-harare",
    name: "Namaste Harare",
    tagline: "Contemporary dining with a Zimbabwean soul",
    category: "Restaurant",
    location: "Borrowdale, Harare",
    distance: "1.2 km",
    rating: 4.8,
    reviews: 312,
    price: "$$$",
    open: true,
    eta: "25–35 min",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85",
    tags: ["Fine dining", "Cocktails", "Date night"],
    description: "A refined Borrowdale dining room blending international technique with Zimbabwean produce.",
    action: "Reserve"
  },
  {
    id: "braai-house",
    name: "The Braai House",
    tagline: "Fire-grilled plates and weekend energy",
    category: "Restaurant",
    location: "Avondale, Harare",
    distance: "1.8 km",
    rating: 4.6,
    reviews: 228,
    price: "$$",
    open: true,
    eta: "20–30 min",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=85",
    tags: ["Braai", "Family", "Takeaway"],
    description: "Flame-grilled meats, sadza sides, salads, and casual group dinners.",
    action: "Order"
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi",
    tagline: "Fresh sushi and modern Japanese plates",
    category: "Restaurant",
    location: "Sam Levy's Village",
    distance: "3.0 km",
    rating: 4.7,
    reviews: 176,
    price: "$$$",
    open: true,
    eta: "30–40 min",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1400&q=85",
    tags: ["Sushi", "Bowls", "Takeaway"],
    description: "A clean sushi bar with platters, rice bowls, and fresh daily specials.",
    action: "Order"
  },
  {
    id: "zb-hair-studio",
    name: "ZB Hair Studio",
    tagline: "Protective styling, cuts, and colour",
    category: "Beauty",
    location: "Newlands, Harare",
    distance: "2.4 km",
    rating: 4.9,
    reviews: 96,
    price: "$$",
    open: false,
    eta: "Next slot 14:30",
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=85",
    tags: ["Braids", "Natural hair", "Colour"],
    description: "A modern salon focused on healthy hair, polished protective styles, and dependable bookings.",
    action: "Book"
  },
  {
    id: "borrowdale-market",
    name: "Borrowdale Fresh Market",
    tagline: "Fresh groceries delivered today",
    category: "Groceries",
    location: "Borrowdale, Harare",
    distance: "1.6 km",
    rating: 4.7,
    reviews: 418,
    price: "$",
    open: true,
    eta: "35–50 min",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85",
    tags: ["Fresh produce", "Pantry", "Same-day"],
    description: "Local produce, bakery, pantry basics, household supplies, and convenient delivery.",
    action: "Shop"
  },
  {
    id: "serenity-spa",
    name: "Serenity Spa",
    tagline: "Reset with intentional wellness",
    category: "Wellness",
    location: "Highlands, Harare",
    distance: "4.1 km",
    rating: 4.8,
    reviews: 142,
    price: "$$$",
    open: true,
    eta: "Next slot 16:00",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1400&q=85",
    tags: ["Massage", "Facials", "Spa day"],
    description: "Calm treatment rooms, skilled therapists, and thoughtful packages for a complete reset.",
    action: "Book"
  }
];

export const events = [
  { id: "e1", title: "Sunset Jazz at The Venue", date: "Sat, 25 Jul", time: "17:30", location: "Borrowdale", price: 15, image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=85" },
  { id: "e2", title: "Harare Food & Culture Market", date: "Sun, 26 Jul", time: "10:00", location: "Belgravia", price: 5, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85" },
  { id: "e3", title: "Paint, Sip & Connect", date: "Fri, 31 Jul", time: "18:00", location: "Newlands", price: 22, image: "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=85" }
];

export const initialBookings = [
  { id: "bk1", business: "Namaste Harare", type: "Table reservation", date: "Today", time: "19:30", status: "Confirmed", amount: 0 },
  { id: "bk2", business: "Serenity Spa", type: "Swedish massage", date: "31 Jul", time: "16:00", status: "Upcoming", amount: 45 },
  { id: "bk3", business: "ZB Hair Studio", type: "Braids consultation", date: "18 Jul", time: "10:30", status: "Completed", amount: 0 }
];

export const quickSearches = ["Dinner tonight", "Weekend events", "Grocery delivery", "Braids near me", "Massage", "Doctor appointment"];
