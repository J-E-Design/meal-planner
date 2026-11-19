// Made-up sample data for the browser tests (the repo is public, so no real household data here).
window.__FIXTURE = {
  meals: [
    { id: "m1", name: "Spaghetti bolognese", ingredients: ["500g mince beef", "Spaghetti", "Tinned tomatoes", "1 onion", "Garlic bread"] },
    { id: "m2", name: "Tacos", ingredients: ["Taco kit", "250g mince beef", "Cheese", "Lettuce", "Salsa"], favourite: true },
    { id: "m3", name: "Sausage and mash", ingredients: ["Sausages", "Mashed potatoes", "Gravy", "Brocolli", "2 onions"] },
    { id: "m4", name: "Fish fingers and chips", ingredients: ["Fish fingers", "Chips", "Peas"], tags: ["fish", "quick"] },
    { id: "m5", name: "Chicken curry", servings: 4, ingredients: ["6 chicken thighs", "2 tbsp curry paste", "400g can chopped tomatoes", "Rice"] },
    { id: "m6", name: "Shepherds pie", ingredients: ["Lamb mince", "Potatoes", "Carrots", "Gravy granules"], defrost: true },
    { id: "m7", name: "Stir fry", ingredients: ["Noodles", "Mixed veg", "Soy sauce"], tags: ["quick", "veggie"] },
    { id: "m8", name: "Pizza", ingredients: ["Frozen pizza x2"] },
    { id: "m9", name: "Jacket potatoes", ingredients: ["Jacket potatoes", "Baked beans", "Cheese"] },
    { id: "m10", name: "Roast chicken", ingredients: ["Whole chicken", "Potatoes", "Carrots", "Gravy"], leftover: "Chicken sandwiches", tags: ["weekend"] },
    { id: "m11", name: "Lasagne", ingredients: ["Lasagne sheets", "500g mince beef", "Passata", "Mozzarella"], tags: ["comfort", "new"] },
    { id: "m12", name: "Omelette", ingredients: ["Eggs", "Cheese", "Ham"], tags: ["quick", "veggie"] },
    { id: "m13", name: "Chicken sandwiches", ingredients: ["Bread", "Lettuce", "Mayo"] },
  ],
  week: [
    { text: "Pizza", locked: false },
    { text: "Sausage and mash", locked: false },
    { text: "Spaghetti bolognese", locked: false },
    { text: "Tacos", locked: true },
    { text: "Chicken curry", locked: false },
    { text: "Takeaway", locked: true, eatingOut: true },
    null,
  ],
  settings: { sound: "nom.mp3", muted: true, confetti: false, darkMode: false, people: ["Alex", "Sam"] },
  history: [],
};
