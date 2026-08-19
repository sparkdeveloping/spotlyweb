export const metadata = {
  title: {
    default: "Spotly Staff",
    template: "%s · Spotly Staff"
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

export default function StaffLayout({ children }) {
  return children;
}
