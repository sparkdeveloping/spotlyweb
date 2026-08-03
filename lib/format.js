export const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatCurrency(value, currencyCode = "USD") {
  const amount = Number(value || 0);
  if (currencyCode === "ZWG") {
    try {
      return new Intl.NumberFormat("en-ZW", { style: "currency", currency: "ZWG", currencyDisplay: "narrowSymbol" }).format(amount).replace("ZWG", "ZiG");
    } catch {
      return `ZiG ${amount.toLocaleString("en-ZW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" }).format(amount).replace("$", "US$");
}

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
