export const driverMetrics = [
  { label: "Today’s earnings", value: "US$38.40", delta: "+US$9.20", hint: "vs. yesterday" },
  { label: "Completed jobs", value: "7", delta: "2 to bonus", hint: "today" },
  { label: "Online time", value: "4h 18m", delta: "82% active", hint: "current shift" },
  { label: "Rating", value: "4.96", delta: "Top 8%", hint: "186 ratings" }
];

export const jobOffers = [
  { id: "JOB-7281", merchant: "Namaste Harare", pickup: "Borrowdale", dropoff: "Mount Pleasant", distance: "7.4 km", duration: "26 min", pay: 6.8, tip: 1.5, type: "Food delivery", priority: true, expires: 42 },
  { id: "JOB-7280", merchant: "Borrowdale Fresh Market", pickup: "Borrowdale", dropoff: "Highlands", distance: "5.1 km", duration: "21 min", pay: 5.4, tip: 0, type: "Grocery delivery", priority: false, expires: 67 },
  { id: "JOB-7279", merchant: "The Braai House", pickup: "Avondale", dropoff: "Milton Park", distance: "4.6 km", duration: "18 min", pay: 4.9, tip: 0.8, type: "Food delivery", priority: false, expires: 88 }
];

export const activeJob = {
  id: "JOB-7278",
  merchant: "Sakura Sushi",
  pickup: "Sam Levy's Village, Borrowdale",
  customer: "Tariro M.",
  dropoff: "20 Ridgeway North, Highlands",
  distance: "6.2 km",
  pay: 6.2,
  tip: 1,
  orderCode: "8241",
  stage: 1,
  timeline: [
    { id: 0, label: "Accepted", detail: "Job accepted at 18:42", done: true },
    { id: 1, label: "At pickup", detail: "Collect order and confirm code 8241", done: true },
    { id: 2, label: "Heading to customer", detail: "6.2 km · approximately 17 min", done: false },
    { id: 3, label: "Delivered", detail: "Confirm customer PIN", done: false }
  ]
};

export const earningsSeries = [18, 31, 27, 44, 38, 52, 46, 63, 58, 71, 67, 82];
export const weeklyEarnings = [
  { day: "Mon", amount: 42.3, jobs: 8 },
  { day: "Tue", amount: 51.2, jobs: 10 },
  { day: "Wed", amount: 38.4, jobs: 7 },
  { day: "Thu", amount: 0, jobs: 0 },
  { day: "Fri", amount: 0, jobs: 0 },
  { day: "Sat", amount: 0, jobs: 0 },
  { day: "Sun", amount: 0, jobs: 0 }
];

export const jobHistory = [
  { id: "JOB-7278", merchant: "Sakura Sushi", route: "Borrowdale → Highlands", date: "Today, 18:42", pay: 7.2, status: "Active" },
  { id: "JOB-7277", merchant: "The Braai House", route: "Avondale → Belvedere", date: "Today, 17:58", pay: 5.8, status: "Completed" },
  { id: "JOB-7276", merchant: "Borrowdale Fresh Market", route: "Borrowdale → Greendale", date: "Today, 16:40", pay: 6.4, status: "Completed" },
  { id: "JOB-7275", merchant: "Namaste Harare", route: "Borrowdale → Mount Pleasant", date: "Today, 15:33", pay: 7.1, status: "Completed" },
  { id: "JOB-7274", merchant: "Chicken Inn CBD", route: "CBD → Avenues", date: "Today, 13:12", pay: 4.8, status: "Completed" }
];
