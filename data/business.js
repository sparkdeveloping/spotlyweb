export const businessMetrics = [
  { label: "Today’s sales", value: "US$1,284.60", delta: "+18.4%", trend: "up", hint: "vs. last Monday" },
  { label: "Active orders", value: "12", delta: "4 new", trend: "neutral", hint: "3 need action" },
  { label: "Bookings", value: "18", delta: "+5", trend: "up", hint: "for today" },
  { label: "Average rating", value: "4.8", delta: "+0.1", trend: "up", hint: "312 reviews" }
];

export const orders = [
  { id: "ORD-4824", customer: "Tatenda N.", type: "Delivery", items: "Family platter, 2 drinks", total: 24.5, status: "New", placed: "2 min ago", eta: "19:42", zone: "Borrowdale" },
  { id: "ORD-4823", customer: "Rudo S.", type: "Collection", items: "2× Signature plate", total: 28, status: "Preparing", placed: "9 min ago", eta: "19:36", zone: "In-store" },
  { id: "ORD-4822", customer: "Tinashe M.", type: "Delivery", items: "Chef’s table deposit", total: 45, status: "Ready", placed: "16 min ago", eta: "19:28", zone: "Highlands" },
  { id: "ORD-4821", customer: "Simba M.", type: "Delivery", items: "Family platter", total: 38, status: "Collected", placed: "31 min ago", eta: "19:15", zone: "Mount Pleasant" },
  { id: "ORD-4820", customer: "Nyasha C.", type: "Collection", items: "Signature plate", total: 12, status: "Completed", placed: "52 min ago", eta: "18:58", zone: "In-store" }
];

export const reservations = [
  { id: "RES-2208", name: "Kudzai Moyo", party: 4, time: "19:30", area: "Main dining", status: "Confirmed", notes: "Birthday dinner" },
  { id: "RES-2209", name: "Farai Dube", party: 2, time: "20:00", area: "Terrace", status: "Pending", notes: "Quiet table if available" },
  { id: "RES-2210", name: "Aisha Khan", party: 6, time: "20:15", area: "Private room", status: "Confirmed", notes: "Client dinner" },
  { id: "RES-2211", name: "Tariro Ndlovu", party: 3, time: "20:45", area: "Main dining", status: "Confirmed", notes: "No allergies" }
];

export const catalogItems = [
  { id: "food1", name: "Signature plate", category: "Popular", price: 12, stock: 34, status: "Active", orders: 86, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" },
  { id: "food2", name: "Chef's table reservation", category: "Reservations", price: 0, stock: 8, status: "Active", orders: 21, image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=80" },
  { id: "food3", name: "Family platter", category: "Combos", price: 38, stock: 12, status: "Active", orders: 48, image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=500&q=80" },
  { id: "food4", name: "Seasonal tasting menu", category: "Dinner", price: 55, stock: 0, status: "Paused", orders: 14, image: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=500&q=80" },
  { id: "food5", name: "House mocktail", category: "Drinks", price: 6, stock: 42, status: "Active", orders: 73, image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=500&q=80" }
];

export const revenueSeries = [42, 58, 48, 71, 66, 86, 92, 78, 104, 97, 118, 128];
export const orderMix = [
  { label: "Delivery", value: 48, color: "#147A4A" },
  { label: "Collection", value: 31, color: "#4ADE80" },
  { label: "Reservations", value: 21, color: "#86E7A9" }
];

export const promotions = [
  { id: "p1", name: "Tuesday dinner for two", code: "TUESDAY20", discount: "20%", redemptions: 83, budget: 300, spent: 187, status: "Active", ends: "31 Jul" },
  { id: "p2", name: "Free delivery Borrowdale", code: "BORROWDALE", discount: "US$3", redemptions: 112, budget: 420, spent: 336, status: "Active", ends: "2 Aug" },
  { id: "p3", name: "Lunch hour special", code: "LUNCH15", discount: "15%", redemptions: 246, budget: 600, spent: 600, status: "Completed", ends: "18 Jul" }
];

export const staff = [
  { id: "s1", name: "Chido Mavhunga", role: "Owner", email: "chido@namaste.co.zw", status: "Active", shift: "Full access" },
  { id: "s2", name: "Kuda Ncube", role: "Manager", email: "kuda@namaste.co.zw", status: "Active", shift: "14:00–Close" },
  { id: "s3", name: "Ruth Banda", role: "Front desk", email: "ruth@namaste.co.zw", status: "Active", shift: "16:00–22:00" },
  { id: "s4", name: "Tanaka Zhou", role: "Kitchen", email: "tanaka@namaste.co.zw", status: "Invited", shift: "Pending" }
];

export const payouts = [
  { id: "POT-3341", date: "24 Jul 2026", amount: 842.1, method: "CABS ••4521", status: "Scheduled" },
  { id: "POT-3338", date: "17 Jul 2026", amount: 724.8, method: "CABS ••4521", status: "Paid" },
  { id: "POT-3331", date: "10 Jul 2026", amount: 680.25, method: "CABS ••4521", status: "Paid" },
  { id: "POT-3324", date: "3 Jul 2026", amount: 591.6, method: "CABS ••4521", status: "Paid" }
];
