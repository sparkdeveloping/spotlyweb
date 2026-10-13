export const metadata = {
  title: {
    default: "Spotly Admin",
    template: "%s · Spotly Admin"
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function AdminLayout({ children }) {
  return children;
}
