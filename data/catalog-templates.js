export const groceryCatalogTemplates = [
  { id: "fresh-produce", name: "Fresh produce", products: ["Tomatoes", "Onions", "Potatoes", "Leafy vegetables", "Bananas", "Apples", "Oranges", "Avocados"] },
  { id: "bakery", name: "Bakery", products: ["White bread", "Brown bread", "Bread rolls", "Buns", "Scones", "Cakes"] },
  { id: "dairy-eggs", name: "Dairy & eggs", products: ["Fresh milk", "Long-life milk", "Eggs", "Yoghurt", "Butter", "Cheese"] },
  { id: "meat-protein", name: "Meat & protein", products: ["Chicken portions", "Beef", "Pork", "Sausages", "Fish", "Beans"] },
  { id: "pantry", name: "Pantry", products: ["Maize meal", "Rice", "Pasta", "Cooking oil", "Sugar", "Flour", "Salt", "Peanut butter"] },
  { id: "beverages", name: "Beverages", products: ["Bottled water", "Juice", "Soft drinks", "Tea", "Coffee", "Energy drinks"] },
  { id: "household", name: "Household", products: ["Dishwashing liquid", "Laundry detergent", "Toilet tissue", "Surface cleaner", "Refuse bags", "Matches"] },
  { id: "personal-care", name: "Personal care", products: ["Bath soap", "Toothpaste", "Deodorant", "Sanitary products", "Body lotion", "Shampoo"] },
  { id: "baby", name: "Baby", products: ["Nappies", "Baby wipes", "Infant cereal", "Baby lotion", "Formula"] },
  { id: "frozen", name: "Frozen", products: ["Frozen chicken", "Frozen vegetables", "Ice cream", "French fries", "Frozen fish"] }
].map((template, categoryIndex) => ({
  ...template,
  order: (categoryIndex + 1) * 10,
  type: "grocery",
  currency: "USD",
  provisional: true,
  products: template.products.map((name, productIndex) => ({
    id: `${template.id}-${productIndex + 1}`,
    name,
    category: template.name,
    price: null,
    sku: "",
    available: true,
    substitutionAllowed: true,
    requiresBusinessReview: true
  }))
}));
