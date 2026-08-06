const groceryGroups = [
  ["fresh-produce", "Fresh produce", ["Tomatoes", "Onions", "Potatoes", "Leafy vegetables", "Bananas", "Apples", "Oranges", "Avocados"]],
  ["bakery", "Bakery", ["White bread", "Brown bread", "Bread rolls", "Buns", "Scones", "Cakes"]],
  ["dairy-eggs", "Dairy & eggs", ["Fresh milk", "Long-life milk", "Eggs", "Yoghurt", "Butter", "Cheese"]],
  ["meat-protein", "Meat & protein", ["Chicken portions", "Beef", "Pork", "Sausages", "Fish", "Sugar beans"]],
  ["zimbabwe-pantry", "Zimbabwe pantry essentials", ["Roller meal", "Rice", "Pasta", "Cooking oil", "Sugar", "Flour", "Salt", "Peanut butter", "Dried kapenta", "Maputi"]],
  ["beverages", "Beverages", ["Bottled water", "Orange crush", "Fruit juice", "Soft drinks", "Tanganda tea", "Coffee", "Energy drinks"]],
  ["household", "Household", ["Dishwashing liquid", "Laundry detergent", "Toilet tissue", "Surface cleaner", "Refuse bags", "Matches"]],
  ["personal-care", "Personal care", ["Bath soap", "Toothpaste", "Deodorant", "Sanitary products", "Body lotion", "Shampoo"]],
  ["baby", "Baby", ["Nappies", "Baby wipes", "Infant cereal", "Baby lotion", "Formula"]],
  ["frozen", "Frozen", ["Frozen chicken", "Frozen vegetables", "Ice cream", "French fries", "Frozen fish"]]
];

const groceryTemplates = groceryGroups.map(([id, name, names], categoryIndex) => ({
  id,
  name,
  description: `Editable ${name.toLowerCase()} starter items. Confirm brands, pack sizes, prices, and availability before publishing.`,
  order: (categoryIndex + 1) * 10,
  type: "grocery",
  businessTypes: ["grocery_retail"],
  currency: "USD",
  provisional: true,
  products: names.map((productName, productIndex) => ({
    id: `${id}-${productIndex + 1}`,
    name: productName,
    category: name,
    price: null,
    sku: "",
    available: true,
    substitutionAllowed: true,
    requiresBusinessReview: true
  }))
}));

const verifiedZimbabweBrandTemplate = {
  id: "zimbabwe-known-brands",
  name: "Zimbabwe-known brand starters",
  description: "Recognizable Zimbabwean product names prepared from manufacturer and retailer references. Confirm pack size, branch availability, barcode, image rights, and price before publishing.",
  type: "grocery",
  businessTypes: ["grocery_retail"],
  currency: "USD",
  provisional: true,
  sourceReviewRequired: true,
  sourceNotes: ["National Foods brand catalogue", "Dairibord brand catalogue", "Colcom product catalogue", "Zimbabwe retailer category listings"],
  products: [
    ["Pearlenta Maize Meal", "Maize meal", "National Foods"],
    ["Red Seal Flour", "Flour & baking", "National Foods"],
    ["Gloria Flour", "Flour & baking", "National Foods"],
    ["Mahatma Rice", "Rice & grains", "National Foods"],
    ["ZimGold Cooking Oil", "Cooking oil", "National Foods"],
    ["Tanganda Tagless Tea Bags", "Tea & coffee", "Tanganda"],
    ["Dairibord Chimombe Long Life Milk", "Dairy", "Dairibord"],
    ["Dairibord Cascade Dairy Fruit Mix", "Beverages", "Dairibord"],
    ["Dairibord Supreme Creme", "Dairy", "Dairibord"],
    ["Dairibord Lacto", "Dairy", "Dairibord"],
    ["Colcom French Polony", "Processed meats", "Colcom"],
    ["Colcom Country Style Boerewors", "Butchery", "Colcom"],
    ["Colcom Red Viennas", "Processed meats", "Colcom"],
    ["Colcom Smoked Viennas", "Processed meats", "Colcom"],
    ["Colcom Pork Pie 120g", "Ready to eat", "Colcom"],
    ["Colcom Beef Pie 120g", "Ready to eat", "Colcom"],
    ["Colcom Streaky Bacon", "Butchery", "Colcom"],
    ["Colcom Premium Bacon", "Butchery", "Colcom"]
  ].map(([name, category, brand], index) => ({
    id: `zw-brand-${index + 1}`,
    name,
    brand,
    category,
    price: null,
    sku: "",
    barcode: "",
    available: false,
    active: false,
    substitutionAllowed: true,
    requiresBusinessReview: true,
    sourceStatus: "official-name-reference"
  }))
};

const zimbabweRetailReferenceTemplate = {
  id: "zimbabwe-retail-reference-shelf",
  name: "Zimbabwe retail shelf references",
  description: "Recognizable product names gathered from official Zimbabwean manufacturer and retailer pages. Every item starts hidden so the business can confirm pack size, price, barcode, stock, and image rights before publishing.",
  type: "grocery",
  businessTypes: ["grocery_retail"],
  currency: "USD",
  provisional: true,
  sourceReviewRequired: true,
  sourceNotes: ["OK Zimbabwe online shop", "National Foods official brand pages", "Dairibord official product pages"],
  products: [
    ["Jade Bath Soap", "Personal care", "Retail shelf reference"],
    ["Royco Usavi Mix 75g", "Cooking ingredients", "Retail shelf reference"],
    ["White Bread", "Bakery", "Retail shelf reference"],
    ["Brown Sugar 2kg", "Sugar & sweeteners", "Retail shelf reference"],
    ["Pilchards in Tomato Sauce 155g", "Canned foods", "Retail shelf reference"],
    ["Peanut Butter 375ml", "Spreads", "Retail shelf reference"],
    ["Willards Cornflakes 500g", "Breakfast cereals", "Retail shelf reference"],
    ["Red Seal Sugar Beans 500g", "Dried foods", "National Foods"],
    ["Pfuko Buttermilk Maheu 500ml", "Beverages", "Retail shelf reference"],
    ["Karinga Usavi Goulash 50g", "Cooking ingredients", "Retail shelf reference"],
    ["Soya Mince Chunks 500g", "Dried foods", "Retail shelf reference"],
    ["Better Buy Roller Maize Meal", "Maize meal", "National Foods"],
    ["Better Buy Pasta", "Pasta", "National Foods"],
    ["Better Buy Rice", "Rice & grains", "National Foods"],
    ["Better Buy Self Raising Flour", "Flour & baking", "National Foods"],
    ["Better Buy Soya Delights", "Dried foods", "National Foods"],
    ["Mahatma Basmati Rice", "Rice & grains", "National Foods"],
    ["Mahatma Jasmine Rice", "Rice & grains", "National Foods"],
    ["Mahatma Brown Rice", "Rice & grains", "National Foods"],
    ["Mahatma Elegant White Rice", "Rice & grains", "National Foods"],
    ["Zapnax Snacks", "Snacks", "National Foods"],
    ["King Snacks", "Snacks", "National Foods"],
    ["Allegros Popticorn", "Snacks", "National Foods"],
    ["Dairibord Black Tea / Rooibos", "Tea & coffee", "Dairibord"],
    ["Dairibord Cascade", "Beverages", "Dairibord"],
    ["Dairibord Chimombe Long Life Milk", "Dairy", "Dairibord"],
    ["Dairibord Drinking Chocolate", "Beverages", "Dairibord"],
    ["Dairibord Flavour Raver", "Dairy", "Dairibord"],
    ["Dairibord Flavoured Yoghurt", "Dairy", "Dairibord"],
    ["Dairibord Fun 'n Fresh", "Beverages", "Dairibord"]
  ].map(([name, category, brand], index) => ({
    id: `zw-retail-${index + 1}`,
    name,
    category,
    brand,
    price: null,
    sku: "",
    barcode: "",
    available: false,
    active: false,
    substitutionAllowed: true,
    requiresBusinessReview: true,
    sourceStatus: "official-name-reference"
  }))
};

const restaurantTemplates = [
  {
    id: "restaurant-core-menu",
    name: "Restaurant core menu",
    description: "A clean menu structure for mains, sides, drinks, and extras.",
    type: "restaurant_food",
    businessTypes: ["restaurant_food"],
    provisional: true,
    products: [
      ["Signature meal", "Main meals"], ["Chicken meal", "Main meals"], ["Beef meal", "Main meals"], ["Vegetarian meal", "Main meals"],
      ["Sadza side", "Sides"], ["Rice side", "Sides"], ["Fresh chips", "Sides"], ["Seasonal vegetables", "Sides"],
      ["Bottled water", "Drinks"], ["Soft drink", "Drinks"], ["Fresh juice", "Drinks"], ["Extra sauce", "Extras"]
    ].map(([name, category], index) => ({ id: `restaurant-core-${index + 1}`, name, category, price: null, requiresBusinessReview: true }))
  },
  {
    id: "cafe-bakery-menu",
    name: "Café and bakery menu",
    description: "Starter categories for hot drinks, cold drinks, pastries, and light meals.",
    type: "restaurant_food",
    businessTypes: ["restaurant_food"],
    provisional: true,
    products: [
      ["Tea", "Hot drinks"], ["Coffee", "Hot drinks"], ["Hot chocolate", "Hot drinks"], ["Fresh juice", "Cold drinks"],
      ["Scone", "Bakery"], ["Muffin", "Bakery"], ["Cake slice", "Bakery"], ["Sandwich", "Light meals"]
    ].map(([name, category], index) => ({ id: `cafe-core-${index + 1}`, name, category, price: null, requiresBusinessReview: true }))
  }
];

const ticketTemplates = [
  {
    id: "event-ticket-starter",
    name: "Event and ticket starter",
    description: "One draft event with common ticket tiers and check-in requirements.",
    type: "ticketing_events",
    businessTypes: ["ticketing_events"],
    provisional: true,
    products: [
      { id: "event-general", name: "General admission", category: "Tickets", itemType: "ticket", price: null, capacity: 0, requiresBusinessReview: true },
      { id: "event-early", name: "Early-bird admission", category: "Tickets", itemType: "ticket", price: null, capacity: 0, requiresBusinessReview: true },
      { id: "event-vip", name: "VIP admission", category: "Tickets", itemType: "ticket", price: null, capacity: 0, requiresBusinessReview: true },
      { id: "event-group", name: "Group admission", category: "Tickets", itemType: "ticket", price: null, capacity: 0, requiresBusinessReview: true }
    ]
  }
];

const serviceTemplates = [
  {
    id: "appointment-services-starter",
    name: "Appointment services starter",
    description: "Common appointment lengths and service placeholders with no invented pricing.",
    type: "appointments_services",
    businessTypes: ["appointments_services"],
    provisional: true,
    products: [
      { id: "service-consultation", name: "Initial consultation", category: "Consultations", itemType: "service", durationMinutes: 30, price: null, requiresBusinessReview: true },
      { id: "service-standard", name: "Standard service", category: "Services", itemType: "service", durationMinutes: 60, price: null, requiresBusinessReview: true },
      { id: "service-followup", name: "Follow-up appointment", category: "Consultations", itemType: "service", durationMinutes: 30, price: null, requiresBusinessReview: true }
    ]
  }
];

const accommodationTemplates = [
  {
    id: "bookable-listings-starter",
    name: "Bookable listings starter",
    description: "Draft room, stay, or activity types ready for the business to confirm.",
    type: "accommodation_activities",
    businessTypes: ["accommodation_activities"],
    provisional: true,
    products: [
      { id: "listing-standard", name: "Standard option", category: "Listings", itemType: "listing", price: null, capacity: 1, requiresBusinessReview: true },
      { id: "listing-premium", name: "Premium option", category: "Listings", itemType: "listing", price: null, capacity: 1, requiresBusinessReview: true },
      { id: "listing-group", name: "Group option", category: "Listings", itemType: "listing", price: null, capacity: 4, requiresBusinessReview: true }
    ]
  }
];

export const groceryCatalogTemplates = [
  ...groceryTemplates,
  verifiedZimbabweBrandTemplate,
  zimbabweRetailReferenceTemplate,
  ...restaurantTemplates,
  ...ticketTemplates,
  ...serviceTemplates,
  ...accommodationTemplates
].map((template, index) => ({ order: template.order || (index + 1) * 10, currency: "USD", ...template }));
