export const adminMetrics = [
  { label: "Active orders", value: "184", delta: "+12%", status: "good", icon: "orders" },
  { label: "Active deliveries", value: "62", delta: "9 delayed", status: "warning", icon: "deliveries" },
  { label: "Online drivers", value: "138", delta: "72% supply", status: "good", icon: "drivers" },
  { label: "Open incidents", value: "8", delta: "2 critical", status: "danger", icon: "incidents" },
  { label: "Business reviews", value: "4", delta: "Oldest 2d", status: "neutral", icon: "business" },
  { label: "Driver reviews", value: "6", delta: "Oldest 1d", status: "neutral", icon: "driverReview" }
];

export const incidents = [
  { id: "INC-0090", type: "Fraud", severity: "Critical", status: "Triaged", summary: "Repeated payment disputes across linked customer accounts.", city: "Harare", owner: "Unassigned", opened: "2 h ago" },
  { id: "INC-0091", type: "Delivery issue", severity: "High", status: "Investigating", summary: "Customer reports order delivered to incorrect address.", city: "Harare", owner: "Aisha Moyo", opened: "48 min ago" },
  { id: "INC-0092", type: "Driver safety", severity: "High", status: "New", summary: "Driver reported aggressive customer interaction.", city: "Bulawayo", owner: "Unassigned", opened: "21 min ago" },
  { id: "INC-0089", type: "Order issue", severity: "Low", status: "Resolved", summary: "Missing side item; partial refund completed.", city: "Harare", owner: "Rudo Ndlovu", opened: "Yesterday" }
];

export const adminOrders = [
  { id: "ORD-4824", business: "Namaste Harare", customer: "T• Ncube", driver: "T. Mutendi", value: 24.5, status: "Preparing", age: "12 min", city: "Harare" },
  { id: "ORD-4823", business: "The Braai House", customer: "S• Moyo", driver: "B. Chirwa", value: 28, status: "Driver assigned", age: "18 min", city: "Harare" },
  { id: "ORD-4822", business: "Sakura Sushi", customer: "R• Sithole", driver: "N. Dube", value: 45, status: "Delayed", age: "47 min", city: "Harare" },
  { id: "ORD-4821", business: "Chicken Inn CBD", customer: "T• Ncube", driver: "B. Chirwa", value: 11.5, status: "Disputed", age: "2 h", city: "Harare" },
  { id: "ORD-4820", business: "Borrowdale Fresh Market", customer: "K• Zhou", driver: "T. Mutendi", value: 39.2, status: "Delivered", age: "3 h", city: "Harare" }
];

export const businesses = [
  { id: "BIZ-001", name: "Namaste Harare", category: "Restaurant", city: "Harare", rating: 4.8, orders: 1248, status: "Active", risk: "Low" },
  { id: "BIZ-002", name: "ZB Hair Studio", category: "Beauty", city: "Harare", rating: 4.9, orders: 428, status: "In review", risk: "Low" },
  { id: "BIZ-003", name: "Nando's Avondale", category: "Restaurant", city: "Harare", rating: 4.6, orders: 2864, status: "Active", risk: "Medium" },
  { id: "BIZ-004", name: "Borrowdale Fresh Market", category: "Grocery", city: "Harare", rating: 4.7, orders: 1932, status: "Active", risk: "Low" },
  { id: "BIZ-005", name: "Taste Lodge Borrowdale", category: "Hospitality", city: "Harare", rating: 4.5, orders: 312, status: "Needs information", risk: "Medium" }
];

export const drivers = [
  { id: "DRV-001", name: "Tendai Mutendi", city: "Harare", vehicle: "Motorbike", rating: 4.96, jobs: 1842, status: "Online", verification: "Approved" },
  { id: "DRV-002", name: "Nomsa Dube", city: "Bulawayo", vehicle: "Motorbike", rating: 0, jobs: 0, status: "Offline", verification: "In review" },
  { id: "DRV-003", name: "Brian Chirwa", city: "Harare", vehicle: "Car", rating: 4.82, jobs: 1188, status: "On delivery", verification: "Approved" },
  { id: "DRV-004", name: "Kudzai Zhou", city: "Harare", vehicle: "Motorbike", rating: 4.71, jobs: 654, status: "Paused", verification: "Approved" },
  { id: "DRV-005", name: "Farai Ncube", city: "Mutare", vehicle: "Car", rating: 0, jobs: 0, status: "Offline", verification: "Needs information" }
];

export const customers = [
  { id: "CUS-001", name: "S• Moyo", city: "Harare", orders: 31, bookings: 9, spend: 684.2, status: "Active", risk: "Low" },
  { id: "CUS-002", name: "T• Ncube", city: "Harare", orders: 18, bookings: 2, spend: 274.5, status: "Restricted", risk: "High" },
  { id: "CUS-003", name: "R• Sithole", city: "Harare", orders: 12, bookings: 14, spend: 1120, status: "Active", risk: "Low" },
  { id: "CUS-004", name: "K• Zhou", city: "Bulawayo", orders: 8, bookings: 4, spend: 198.4, status: "Active", risk: "Low" }
];

export const transactions = [
  { id: "TXN-88421", type: "Order", business: "Namaste Harare", gross: 24.5, fees: 2.45, net: 22.05, status: "Completed", date: "Today, 19:04" },
  { id: "TXN-88420", type: "Order", business: "Nando's Avondale", gross: 11.5, fees: 1.15, net: 10.35, status: "Completed", date: "Today, 18:52" },
  { id: "TXN-88419", type: "Order", business: "Chicken Inn CBD", gross: 8, fees: 0.8, net: 7.2, status: "Disputed", date: "Today, 17:12" },
  { id: "TXN-88418", type: "Booking", business: "Taste Lodge Borrowdale", gross: 120, fees: 6, net: 114, status: "Completed", date: "Yesterday" }
];

export const platformServices = [
  { id: "svc1", name: "Customer app", status: "Operational", latency: "124 ms", uptime: "99.99%" },
  { id: "svc2", name: "Business app", status: "Operational", latency: "118 ms", uptime: "99.99%" },
  { id: "svc3", name: "Driver app", status: "Operational", latency: "132 ms", uptime: "99.98%" },
  { id: "svc4", name: "Admin app", status: "Operational", latency: "96 ms", uptime: "100%" },
  { id: "svc5", name: "Authentication", status: "Operational", latency: "84 ms", uptime: "99.99%" },
  { id: "svc6", name: "Payments", status: "Degraded", latency: "742 ms", uptime: "99.71%" },
  { id: "svc7", name: "Driver dispatch", status: "Operational", latency: "188 ms", uptime: "99.94%" },
  { id: "svc8", name: "Push notifications", status: "Operational", latency: "156 ms", uptime: "99.90%" }
];

export const auditLog = [
  { id: "AUD-001", actor: "Tanaka Chikwanda", action: "Approved document", entity: "Business Registration — ZB Hair Studio", reason: "Verified against registry", time: "12 min ago" },
  { id: "AUD-002", actor: "Aisha Moyo", action: "Assigned incident", entity: "INC-0091", reason: "Operations queue triage", time: "48 min ago" },
  { id: "AUD-003", actor: "Rudo Ndlovu", action: "Resolved incident", entity: "INC-0089", reason: "Partial refund issued", time: "Yesterday" },
  { id: "AUD-004", actor: "System", action: "Held payout", entity: "POT-3340 — Nando's Avondale", reason: "Active dispute TXN-88419", time: "2 days ago" }
];
