// Seed default products and ingredients into localStorage if empty
(function seedDefaults() {
  try {
    const products = JSON.parse(localStorage.getItem("tp_products") || "[]");
    const ingredients = JSON.parse(localStorage.getItem("tp_ingredients") || "[]");

    const needProducts = !Array.isArray(products) || products.length === 0;
    const needIngredients = !Array.isArray(ingredients) || ingredients.length === 0;

    const now = Date.now();
    const defaultProducts = [
      { id: now + 1, name: "Margherita Pizza", category: "Pizza", price: 350, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.2 }, { ingredientName: "Tomato Sauce", quantity: 0.1 }, { ingredientName: "Basil", quantity: 1 } ] },
      { id: now + 2, name: "Pepperoni Pizza", category: "Pizza", price: 420, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.25 }, { ingredientName: "Tomato Sauce", quantity: 0.1 } ] },
      { id: now + 3, name: "Cheese Bread", category: "Pastries", price: 80, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.1 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
      { id: now + 4, name: "Basil Bread", category: "Pastries", price: 90, imageDataUrl: "", recipe: [ { ingredientName: "Basil", quantity: 2 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
      { id: now + 5, name: "Tomato Basil Dip", category: "Beverages", price: 60, imageDataUrl: "", recipe: [ { ingredientName: "Tomato Sauce", quantity: 0.2 }, { ingredientName: "Basil", quantity: 1 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
    ];

    const defaultIngredients = [
      { name: "Mozzarella Cheese", stockUnit: "kg", availableQuantity: 2 },
      { name: "Tomato Sauce", stockUnit: "L", availableQuantity: 3 },
      { name: "Basil", stockUnit: "g", availableQuantity: 10 },
      { name: "Olive Oil", stockUnit: "L", availableQuantity: 1 },
    ];

    if (needProducts) localStorage.setItem("tp_products", JSON.stringify(defaultProducts));
    if (needIngredients) localStorage.setItem("tp_ingredients", JSON.stringify(defaultIngredients));
  } catch (_) {
    // ignore
  }
})();


