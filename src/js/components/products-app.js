/*
  Products management Alpine component for Products page.
  - Maintains products and ingredients in localStorage
  - Supports list, add, edit, delete
  - Each product has linked ingredients (recipe) with quantities
  - Status auto-computed from ingredient availability
  - CSV import/export (Excel-friendly via CSV)
*/

(function attachProductsApp() {
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function toCSV(rows) {
    if (!rows || rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (val) => {
      const s = String(val ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = [];
    lines.push(headers.join(","));
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    }
    return lines.join("\n");
  }

  function parseCSV(text) {
    // Simple CSV parser (no multiline fields). Accepts quoted fields.
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const parseLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (line[i + 1] === '"') {
              current += '"';
              i += 1;
            } else {
              inQuotes = false;
            }
          } else {
            current += ch;
          }
        } else if (ch === ',') {
          result.push(current);
          current = "";
        } else if (ch === '"') {
          inQuotes = true;
        } else {
          current += ch;
        }
      }
      result.push(current);
      return result;
    };
    const headers = parseLine(lines[0]).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] ?? "";
      });
      rows.push(obj);
    }
    return rows;
  }

  function computeProductStatus(product, ingredientNameToStock) {
    if (!product || !Array.isArray(product.recipe)) return "Unavailable";
    for (const item of product.recipe) {
      const available = ingredientNameToStock[item.ingredientName] ?? 0;
      if (available <= 0 || Number.isNaN(available)) return "Unavailable";
    }
    return "Available";
  }

  function productsApp() {
    return {
      // State
      products: [], // [{ id, name, category, price, imageDataUrl, recipe:[{ingredientName, quantity}], status }]
      ingredients: [], // [{ name, stockUnit, availableQuantity }]
      modalOpen: false,
      isEditing: false,
      editIndex: -1,
      form: {
        name: "",
        category: "",
        price: "",
        imageDataUrl: "",
        recipe: [],
      },
      importError: "",

      init() {
        // Load from localStorage or seed defaults
        try {
          const savedProducts = JSON.parse(localStorage.getItem("tp_products") || "[]");
          const savedIngredients = JSON.parse(localStorage.getItem("tp_ingredients") || "[]");
          this.products = Array.isArray(savedProducts) ? savedProducts : [];
          if (Array.isArray(savedIngredients) && savedIngredients.length > 0) {
            this.ingredients = savedIngredients;
          } else {
            this.ingredients = [
              { name: "Mozzarella Cheese", stockUnit: "kg", availableQuantity: 2 },
              { name: "Tomato Sauce", stockUnit: "L", availableQuantity: 3 },
              { name: "Basil", stockUnit: "g", availableQuantity: 10 },
              { name: "Olive Oil", stockUnit: "L", availableQuantity: 1 },
            ];
          }
          if (!this.products.length) {
            const t = Date.now();
            this.products = [
              { id: t + 1, name: "Margherita Pizza", category: "Pizza", price: 350, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.2 }, { ingredientName: "Tomato Sauce", quantity: 0.1 }, { ingredientName: "Basil", quantity: 1 } ] },
              { id: t + 2, name: "Pepperoni Pizza", category: "Pizza", price: 420, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.25 }, { ingredientName: "Tomato Sauce", quantity: 0.1 } ] },
              { id: t + 3, name: "Cheese Bread", category: "Pastries", price: 80, imageDataUrl: "", recipe: [ { ingredientName: "Mozzarella Cheese", quantity: 0.1 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
              { id: t + 4, name: "Basil Bread", category: "Pastries", price: 90, imageDataUrl: "", recipe: [ { ingredientName: "Basil", quantity: 2 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
              { id: t + 5, name: "Tomato Basil Dip", category: "Beverages", price: 60, imageDataUrl: "", recipe: [ { ingredientName: "Tomato Sauce", quantity: 0.2 }, { ingredientName: "Basil", quantity: 1 }, { ingredientName: "Olive Oil", quantity: 0.02 } ] },
            ];
          }
          this.refreshStatuses();
        } catch (e) {
          this.products = [];
          this.ingredients = [];
        }
      },

      save() {
        localStorage.setItem("tp_products", JSON.stringify(this.products));
        localStorage.setItem("tp_ingredients", JSON.stringify(this.ingredients));
      },

      refreshStatuses() {
        const stockMap = this.ingredients.reduce((acc, it) => {
          acc[it.name] = Number(it.availableQuantity) || 0;
          return acc;
        }, {});
        this.products = this.products.map((p) => ({
          ...p,
          status: computeProductStatus(p, stockMap),
        }));
        this.save();
      },

      openAdd() {
        this.isEditing = false;
        this.editIndex = -1;
        this.form = {
          name: "",
          category: "",
          price: "",
          imageDataUrl: "",
          recipe: [],
        };
        this.modalOpen = true;
      },

      openEdit(index) {
        this.isEditing = true;
        this.editIndex = index;
        const p = this.products[index];
        this.form = {
          name: p.name,
          category: p.category,
          price: String(p.price),
          imageDataUrl: p.imageDataUrl || "",
          recipe: (p.recipe || []).map((r) => ({ ...r })),
        };
        this.modalOpen = true;
      },

      remove(index) {
        this.products.splice(index, 1);
        this.save();
      },

      async onImageSelected(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const dataUrl = await readFileAsDataUrl(file);
        this.form.imageDataUrl = dataUrl;
      },

      addRecipeItem() {
        this.form.recipe.push({ ingredientName: this.ingredients[0]?.name || "", quantity: "" });
      },

      removeRecipeItem(idx) {
        this.form.recipe.splice(idx, 1);
      },

      submit() {
        const priceNumber = Number(this.form.price);
        const product = {
          id: this.isEditing ? this.products[this.editIndex].id : Date.now(),
          name: this.form.name.trim(),
          category: this.form.category.trim(),
          price: Number.isFinite(priceNumber) ? priceNumber : 0,
          imageDataUrl: this.form.imageDataUrl || "",
          recipe: (this.form.recipe || []).map((r) => ({
            ingredientName: r.ingredientName,
            quantity: Number(r.quantity) || 0,
          })),
        };

        // compute status
        const stockMap = this.ingredients.reduce((acc, it) => {
          acc[it.name] = Number(it.availableQuantity) || 0;
          return acc;
        }, {});
        product.status = computeProductStatus(product, stockMap);

        if (this.isEditing) {
          this.products.splice(this.editIndex, 1, product);
        } else {
          this.products.unshift(product);
        }
        this.modalOpen = false;
        this.save();
      },

      async importCSV(event) {
        this.importError = "";
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const text = await file.text();
        const rows = parseCSV(text);
        // Expected headers: name, category, price, imageUrl, recipe
        // recipe format: "Ingredient A:1; Ingredient B:2"
        const imported = [];
        for (const row of rows) {
          const recipe = String(row.recipe || "")
            .split(";")
            .map((pair) => pair.trim())
            .filter(Boolean)
            .map((pair) => {
              const [ingredientName, qty] = pair.split(":").map((s) => s.trim());
              return { ingredientName, quantity: Number(qty) || 0 };
            });
          imported.push({
            id: Date.now() + Math.random(),
            name: row.name || "",
            category: row.category || "",
            price: Number(row.price) || 0,
            imageDataUrl: row.imageUrl || "",
            recipe,
          });
        }
        this.products = [...imported, ...this.products];
        this.refreshStatuses();
      },

      exportCSV() {
        const rows = this.products.map((p) => ({
          name: p.name,
          category: p.category,
          price: p.price,
          imageUrl: p.imageDataUrl || "",
          recipe: (p.recipe || [])
            .map((r) => `${r.ingredientName}:${r.quantity}`)
            .join("; "),
          status: p.status,
        }));
        const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "products.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    };
  }

  // Expose factory globally for x-data usage in HTML
  window.productsApp = productsApp;
})();


