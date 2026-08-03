// Product catalog for Maa Annapurna Mart
// icon: emoji used as a lightweight placeholder image (no external assets needed)

const CATEGORIES = [
  { id: "grocery", label: "Grocery", icon: "🌾" },
  { id: "vegetables", label: "Vegetables", icon: "🥦" },
  { id: "fruits", label: "Fruits", icon: "🍎" },
  { id: "dairy", label: "Dairy & Bakery", icon: "🥛" },
  { id: "snacks", label: "Snacks", icon: "🍪" },
  { id: "beverages", label: "Beverages", icon: "🧃" },
  { id: "personal-care", label: "Personal Care", icon: "🧴" },
  { id: "household", label: "Household", icon: "🧹" },
];

const PRODUCTS = [
  // Grocery
  { id: "g1", category: "grocery", name: "Tata Atta", unit: "5 kg", price: 235, icon: "🌾" },
  { id: "g2", category: "grocery", name: "India Gate Basmati Rice", unit: "5 kg", price: 420, icon: "🍚" },
  { id: "g3", category: "grocery", name: "Toor Dal", unit: "1 kg", price: 165, icon: "🫘" },
  { id: "g4", category: "grocery", name: "Moong Dal", unit: "1 kg", price: 130, icon: "🫘" },
  { id: "g5", category: "grocery", name: "Fortune Sunflower Oil", unit: "1 L", price: 145, icon: "🛢️" },
  { id: "g6", category: "grocery", name: "Tata Salt", unit: "1 kg", price: 28, icon: "🧂" },
  { id: "g7", category: "grocery", name: "Sugar", unit: "1 kg", price: 46, icon: "🍬" },
  { id: "g8", category: "grocery", name: "Besan", unit: "500 g", price: 58, icon: "🌾" },

  // Vegetables
  { id: "v1", category: "vegetables", name: "Onion", unit: "1 kg", price: 35, icon: "🧅" },
  { id: "v2", category: "vegetables", name: "Potato", unit: "1 kg", price: 28, icon: "🥔" },
  { id: "v3", category: "vegetables", name: "Tomato", unit: "1 kg", price: 40, icon: "🍅" },
  { id: "v4", category: "vegetables", name: "Green Capsicum", unit: "500 g", price: 35, icon: "🫑" },
  { id: "v5", category: "vegetables", name: "Cauliflower", unit: "1 pc", price: 30, icon: "🥦" },
  { id: "v6", category: "vegetables", name: "Spinach (Palak)", unit: "1 bunch", price: 20, icon: "🥬" },

  // Fruits
  { id: "f1", category: "fruits", name: "Banana", unit: "1 dozen", price: 55, icon: "🍌" },
  { id: "f2", category: "fruits", name: "Apple (Shimla)", unit: "1 kg", price: 180, icon: "🍎" },
  { id: "f3", category: "fruits", name: "Papaya", unit: "1 pc", price: 40, icon: "🥭" },
  { id: "f4", category: "fruits", name: "Orange", unit: "1 kg", price: 90, icon: "🍊" },

  // Dairy & Bakery
  { id: "d1", category: "dairy", name: "Amul Milk", unit: "500 ml", price: 30, icon: "🥛" },
  { id: "d2", category: "dairy", name: "Amul Butter", unit: "100 g", price: 58, icon: "🧈" },
  { id: "d3", category: "dairy", name: "Paneer", unit: "200 g", price: 90, icon: "🧀" },
  { id: "d4", category: "dairy", name: "Bread", unit: "1 pack", price: 40, icon: "🍞" },
  { id: "d5", category: "dairy", name: "Curd", unit: "400 g", price: 35, icon: "🥣" },

  // Snacks
  { id: "s1", category: "snacks", name: "Lay's Chips", unit: "52 g", price: 20, icon: "🍟" },
  { id: "s2", category: "snacks", name: "Parle-G Biscuit", unit: "250 g", price: 30, icon: "🍪" },
  { id: "s3", category: "snacks", name: "Haldiram Namkeen", unit: "200 g", price: 65, icon: "🥨" },
  { id: "s4", category: "snacks", name: "Maggi Noodles", unit: "4 pack", price: 56, icon: "🍜" },

  // Beverages
  { id: "b1", category: "beverages", name: "Coca-Cola", unit: "750 ml", price: 40, icon: "🥤" },
  { id: "b2", category: "beverages", name: "Real Fruit Juice", unit: "1 L", price: 110, icon: "🧃" },
  { id: "b3", category: "beverages", name: "Tea Powder", unit: "250 g", price: 130, icon: "🍵" },
  { id: "b4", category: "beverages", name: "Nescafe Coffee", unit: "50 g", price: 145, icon: "☕" },

  // Personal Care
  { id: "p1", category: "personal-care", name: "Colgate Toothpaste", unit: "150 g", price: 95, icon: "🪥" },
  { id: "p2", category: "personal-care", name: "Dove Soap", unit: "1 pc", price: 55, icon: "🧼" },
  { id: "p3", category: "personal-care", name: "Head & Shoulders Shampoo", unit: "180 ml", price: 175, icon: "🧴" },

  // Household
  { id: "h1", category: "household", name: "Vim Dishwash Bar", unit: "1 pc", price: 20, icon: "🧽" },
  { id: "h2", category: "household", name: "Surf Excel Detergent", unit: "1 kg", price: 130, icon: "🧺" },
  { id: "h3", category: "household", name: "Harpic Toilet Cleaner", unit: "500 ml", price: 95, icon: "🧹" },
];
