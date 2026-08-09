function normalizeHeader(value = "") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function parseCsvRows(text = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

export function rowsToCatalogueItems(rows = [], defaults = {}) {
  if (!rows.length) return [];
  const first = rows[0].map(normalizeHeader);
  const known = new Set(["name", "product", "product_name", "category", "price", "currency", "sku", "code", "barcode", "gtin", "brand", "variant", "pack_size", "packsize", "stock", "stock_quantity", "availability", "location", "branch"]);
  const hasHeader = first.some((header) => known.has(header));
  const headers = hasHeader ? first : ["name", "category", "price", "currency", "sku", "barcode", "brand", "variant", "pack_size", "stock_quantity", "availability", "location"];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const get = (record, aliases) => {
    for (const alias of aliases) {
      const index = headers.indexOf(alias);
      if (index >= 0 && record[index] !== undefined) return String(record[index]).trim();
    }
    return "";
  };

  return dataRows.map((record) => {
    const priceRaw = get(record, ["price"]);
    const stockRaw = get(record, ["stock_quantity", "stock"]);
    const availabilityRaw = get(record, ["availability"]).toLowerCase();
    const barcode = get(record, ["barcode", "gtin"]);
    const name = get(record, ["name", "product", "product_name"]);
    const priceNumber = priceRaw === "" ? null : Number(priceRaw);
    const stockNumber = stockRaw === "" ? 0 : Number(stockRaw);
    const stockStatus = ["out", "out_of_stock", "unavailable", "false", "0"].includes(availabilityRaw) ? "unavailable" : ["low", "low_stock", "limited"].includes(availabilityRaw) ? "low_stock" : "in_stock";
    return {
      ...defaults,
      name,
      category: get(record, ["category"]) || defaults.category || "General",
      price: Number.isFinite(priceNumber) ? priceNumber : 0,
      priceMissing: priceRaw === "" || !Number.isFinite(priceNumber),
      currency: (get(record, ["currency"]) || defaults.currency || "USD").toUpperCase(),
      sku: get(record, ["sku", "code"]),
      barcode,
      gtin: barcode,
      brand: get(record, ["brand"]),
      variant: get(record, ["variant"]),
      packSize: get(record, ["pack_size", "packsize"]),
      stockMode: stockRaw ? "quantity" : defaults.stockMode || "status",
      stockQuantity: Number.isFinite(stockNumber) ? stockNumber : 0,
      stockStatus,
      importLocationLabel: get(record, ["location", "branch"])
    };
  }).filter((item) => item.name);
}

export function parseCatalogueCsv(text, defaults = {}) {
  return rowsToCatalogueItems(parseCsvRows(text), defaults);
}
