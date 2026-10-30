/**
 * Non-transactional product discovery categories. Taxonomy is derived from
 * identities/merchant-supplied categories; it never supplies prices or inventory.
 */
const RULES = [
  { pattern: /\b(exercise book|notebook|copy book|school book|quire)\b/i, path: ["Shopping", "Stationery & school", "Exercise books"] },
  { pattern: /\b(pen|pencil|eraser|ruler|highlighter|stationery|paper|glue stick)\b/i, path: ["Shopping", "Stationery & school", "Writing & supplies"] },
  { pattern: /\b(nappy|nappies|diaper|baby wipes|infant formula)\b/i, path: ["Shopping", "Baby & family", "Baby essentials"] },
  { pattern: /\b(dog food|cat food|pet food|pet litter)\b/i, path: ["Shopping", "Pet supplies", "Food & care"] },
  { pattern: /\b(soap|shampoo|toothpaste|deodorant|lotion|sanitary pads|toothbrush)\b/i, path: ["Shopping", "Health & beauty", "Personal care"] },
  { pattern: /\b(detergent|bleach|washing powder|dishwashing|surface cleaner|fabric softener)\b/i, path: ["Shopping", "Home essentials", "Cleaning & laundry"] },
  { pattern: /\b(tissue|toilet paper|paper towel|foil|cling wrap|bin bag)\b/i, path: ["Shopping", "Home essentials", "Household supplies"] },
  { pattern: /\b(beef|chicken|pork|sausage|fish|meat)\b/i, path: ["Groceries", "Fresh food", "Meat & seafood"] },
  { pattern: /\b(apples?|bananas?|oranges?|mangoes?|mangos?|avocados?|grapes?|pears?|pineapples?)\b/i, path: ["Groceries", "Fresh produce", "Fruit"] },
  { pattern: /\b(potatoes?|tomatoes?|onions?|carrots?|cabbages?|spinach|vegetables?|lettuce)\b/i, path: ["Groceries", "Fresh produce", "Vegetables"] },
  { pattern: /\b(milk|cheese|yogh?urt|butter|cream)\b/i, path: ["Groceries", "Chilled & dairy", "Dairy"] },
  { pattern: /\b(bread|bun|croissant|muffin|cake|biscuit)\b/i, path: ["Groceries", "Bakery & snacks", "Breads & treats"] },
  { pattern: /\b(rice|flour|mealie[ -]?meal|meal[ -]?meal|sugar|salt|cooking oil|pasta|beans|maize meal|peanut butter|dovi|kapenta|matemba)\b/i, path: ["Groceries", "Pantry", "Cooking staples"] },
  { pattern: /\b(juice|water|soft drink|soda|tea|coffee)\b/i, path: ["Groceries", "Drinks", "Everyday drinks"] },
  { pattern: /\b(frozen|ice cream|frozen peas|frozen chips)\b/i, path: ["Groceries", "Frozen", "Frozen foods"] }
];
const VAGUE = new Set(["", "groceries", "products", "shopping", "general", "other", "uncategorized", "miscellaneous"]);

export function categorizeMarketplaceProduct(product = {}) {
  const given = (Array.isArray(product.categoryPath) ? product.categoryPath : [product.category]).filter((item) => typeof item === "string" && item.trim());
  // Preserve meaningful source- or merchant-provided categories, never erase fine-grained human classifications.
  if (given.length >= 2 && !VAGUE.has(given[given.length - 1].trim().toLowerCase())) {
    return { path: given, confidence: "source", basis: "source_category" };
  }
  const title = [product.canonicalName, product.name].filter(Boolean).join(" ");
  const rule = RULES.find((candidate) => candidate.pattern.test(title));
  if (rule) return { path: rule.path, confidence: "inferred", basis: "product_name" };
  return { path: given.length && !VAGUE.has(given[given.length - 1].trim().toLowerCase()) ? given : ["Groceries", "Everyday essentials"], confidence: "general", basis: "fallback" };
}

export function enrichMarketplaceProduct(product = {}) {
  const result = categorizeMarketplaceProduct(product);
  return { ...product, sourceCategoryPath: product.categoryPath || [], categoryPath: result.path, categoryConfidence: result.confidence, categoryBasis: result.basis };
}
