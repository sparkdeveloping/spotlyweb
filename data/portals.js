import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  Bike,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CircleUserRound,
  ClipboardList,
  Compass,
  CreditCard,
  Heart,
  House,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MapPinned,
  PackageCheck,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UsersRound,
  WalletCards
} from "lucide-react";

export const portals = {
  customer: {
    id: "customer",
    name: "Spotly",
    label: "Customer",
    href: "/",
    logo: "/brand/spotly.png",
    accent: "#6657D9",
    accentStrong: "#4E3FBF",
    accentSoft: "#F0EEFF",
    darkAccent: "#9B8CFF",
    description: "Discover, book, order, and plan your city.",
    nav: [
      { id: "home", label: "Home", icon: House, href: "/" },
      { id: "search", label: "Search", icon: Search, href: "/?view=search" },
      { id: "bookings", label: "Bookings", icon: CalendarDays, href: "/?view=bookings" },
      { id: "saved", label: "Saved", icon: Heart, href: "/?view=saved" },
      { id: "profile", label: "Profile", icon: CircleUserRound, href: "/?view=profile" }
    ]
  },
  business: {
    id: "business",
    name: "Spotly Business",
    label: "Business",
    href: "/business",
    logo: "/brand/spotly-business.png",
    accent: "#147A4A",
    accentStrong: "#0E5C36",
    accentSoft: "#E8F5ED",
    darkAccent: "#4ADE80",
    description: "Run orders, bookings, catalog, staff, and finances.",
    nav: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/business" },
      { id: "activity", label: "Activity", icon: ClipboardList, href: "/business/activity", badge: 7 },
      { id: "catalog", label: "Catalog", icon: BookOpenCheck, href: "/business/catalog" },
      { id: "insights", label: "Insights", icon: BarChart3, href: "/business/insights" },
      { id: "promotions", label: "Promotions", icon: BadgeDollarSign, href: "/business/promotions" },
      { id: "staff", label: "Staff", icon: UsersRound, href: "/business/staff" },
      { id: "finance", label: "Finance", icon: WalletCards, href: "/business/finance" },
      { id: "settings", label: "Settings", icon: Settings, href: "/business/settings" }
    ]
  },
  driver: {
    id: "driver",
    name: "Spotly Driver",
    label: "Driver",
    href: "/driver",
    logo: "/brand/spotly-driver.png",
    accent: "#2563EB",
    accentStrong: "#1D4ED8",
    accentSoft: "#EAF1FF",
    darkAccent: "#60A5FA",
    description: "Manage offers, active jobs, shifts, and earnings.",
    nav: [
      { id: "home", label: "Home", icon: House, href: "/driver" },
      { id: "jobs", label: "Jobs", icon: ListChecks, href: "/driver/jobs", badge: 3 },
      { id: "active", label: "Active job", icon: MapPinned, href: "/driver/active" },
      { id: "earnings", label: "Earnings", icon: BadgeDollarSign, href: "/driver/earnings" },
      { id: "history", label: "History", icon: PackageCheck, href: "/driver/history" },
      { id: "support", label: "Safety & support", icon: LifeBuoy, href: "/driver/support" },
      { id: "profile", label: "Profile", icon: CircleUserRound, href: "/driver/profile" }
    ]
  },
  admin: {
    id: "admin",
    name: "Spotly Admin",
    label: "Admin",
    href: "/admin",
    logo: "/brand/spotly-admin.png",
    accent: "#28466F",
    accentStrong: "#1B3152",
    accentSoft: "#EAF0F7",
    darkAccent: "#78A5D8",
    description: "Operate the platform, review risk, and manage access.",
    nav: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
      { id: "operations", label: "Operations", icon: Truck, href: "/admin/operations", badge: 12 },
      { id: "businesses", label: "Businesses", icon: Building2, href: "/admin/businesses", badge: 4 },
      { id: "drivers", label: "Drivers", icon: Bike, href: "/admin/drivers", badge: 6 },
      { id: "customers", label: "Customers", icon: UsersRound, href: "/admin/customers" },
      { id: "finance", label: "Finance", icon: CreditCard, href: "/admin/finance" },
      { id: "content", label: "Content", icon: Compass, href: "/admin/content" },
      { id: "platform", label: "Platform", icon: ShieldCheck, href: "/admin/platform" },
      { id: "audit", label: "Audit log", icon: ClipboardList, href: "/admin/audit" },
      { id: "settings", label: "Settings", icon: Settings, href: "/admin/settings" }
    ]
  }
};

export const globalNotifications = {
  customer: [
    { id: "c1", title: "Booking confirmed", message: "Your table at Namaste Harare is confirmed for 19:30.", time: "8 min", unread: true },
    { id: "c2", title: "Order on the way", message: "Your driver is 6 minutes away.", time: "21 min", unread: true },
    { id: "c3", title: "Weekend picks", message: "Five new events match your interests.", time: "2 h", unread: false }
  ],
  business: [
    { id: "b1", title: "New order ORD-4824", message: "US$24.50 · Delivery · 4 items", time: "Now", unread: true },
    { id: "b2", title: "Reservation request", message: "Table for 4 at 19:30 tonight.", time: "4 min", unread: true },
    { id: "b3", title: "Payout scheduled", message: "US$842.10 will arrive on Friday.", time: "1 h", unread: false }
  ],
  driver: [
    { id: "d1", title: "Priority job available", message: "Borrowdale → Mount Pleasant · US$6.80", time: "Now", unread: true },
    { id: "d2", title: "Weekly goal", message: "Two more jobs to unlock your US$12 bonus.", time: "18 min", unread: true },
    { id: "d3", title: "Payout sent", message: "US$86.40 was sent to EcoCash.", time: "Yesterday", unread: false }
  ],
  admin: [
    { id: "a1", title: "Critical incident INC-0090", message: "Fraud pattern detected. Immediate review required.", time: "5 min", unread: true },
    { id: "a2", title: "Payout POT-3340 on hold", message: "Active dispute requires finance review.", time: "24 min", unread: true },
    { id: "a3", title: "Driver application submitted", message: "Nomsa Dube is ready for verification.", time: "2 h", unread: false }
  ]
};
