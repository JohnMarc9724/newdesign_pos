/*
  POS management Alpine component for POS page.
  - Loads products and ingredients from localStorage (set by products page)
  - Product search & selection (by name/category/barcode*)
  - Cart with qty edit/remove and totals (subtotal, tax, discount, total)
  - Payment processing (Cash/Card/E-Wallet) and receipt generation
  - Ingredient deduction on successful sale; sale history with refund & reprint
  * barcode: optional property on product (if available in import/export)
*/

(function attachPosApp() {
  function computeProductStatus(product, ingredientNameToStock) {
    if (!product || !Array.isArray(product.recipe)) return "Unavailable";
    for (const item of product.recipe) {
      const available = ingredientNameToStock[item.ingredientName] ?? 0;
      if (available <= 0 || Number.isNaN(available)) return "Unavailable";
    }
    return "Available";
  }

  function formatCurrency(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-PH", { style: "currency", currency: "PHP" });
  }

  function openPrintWindow(html) {
    const w = window.open("", "_blank", "width=360,height=600");
    if (!w) return;
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>Receipt</title>
      <meta charset='utf-8'/>
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; padding: 16px; }
        h2 { margin: 0 0 8px; font-size: 18px; }
        .muted { color: #6b7280; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { text-align: left; padding: 6px 0; font-size: 12px; border-bottom: 1px dashed #e5e7eb; }
        .totals td { border-bottom: none; }
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function posApp() {
    return {
      // Data
      products: [], // from localStorage
      ingredients: [], // from localStorage
      sales: [], // from localStorage

      // UI state
      search: "",
      categoryFilter: "",
      showAvailableOnly: true,

      // Cart
      cart: [], // [{ productId, name, price, qty }]
      discountType: "none", // none | percent | amount
      discountValue: 0,
      taxPercent: 0,
      paymentMethod: "Cash", // Cash | Card | E-Wallet
      cashGiven: "",
      paymentError: "",

      // History
      historySearch: "",

      init() {
        try {
          const savedProducts = JSON.parse(localStorage.getItem("tp_products") || "[]");
          const savedIngredients = JSON.parse(localStorage.getItem("tp_ingredients") || "[]");
          const savedSales = JSON.parse(localStorage.getItem("tp_sales") || "[]");
          this.products = Array.isArray(savedProducts) ? savedProducts : [];
          this.ingredients = Array.isArray(savedIngredients) ? savedIngredients : [];
          this.sales = Array.isArray(savedSales) ? savedSales : [];

          // If empty, leave seeding to products page component
          if (this.ingredients.length === 0) {
            this.ingredients = [
              { name: "Mozzarella Cheese", stockUnit: "kg", availableQuantity: 2 },
              { name: "Tomato Sauce", stockUnit: "L", availableQuantity: 3 },
              { name: "Basil", stockUnit: "g", availableQuantity: 10 },
              { name: "Olive Oil", stockUnit: "L", availableQuantity: 1 },
            ];
          }
          this._refreshProductStatuses();
        } catch (e) {
          this.products = [];
          this.ingredients = [];
          this.sales = [];
        }
      },

      _save() {
        localStorage.setItem("tp_products", JSON.stringify(this.products));
        localStorage.setItem("tp_ingredients", JSON.stringify(this.ingredients));
        localStorage.setItem("tp_sales", JSON.stringify(this.sales));
      },

      _refreshProductStatuses() {
        const stockMap = this.ingredients.reduce((acc, it) => {
          acc[it.name] = Number(it.availableQuantity) || 0;
          return acc;
        }, {});
        this.products = this.products.map((p) => ({
          ...p,
          status: computeProductStatus(p, stockMap),
        }));
        this._save();
      },

      filteredProducts() {
        const q = this.search.trim().toLowerCase();
        return this.products.filter((p) => {
          if (this.showAvailableOnly && p.status !== "Available") return false;
          if (this.categoryFilter && p.category !== this.categoryFilter) return false;
          if (!q) return true;
          const hay = [p.name, p.category, p.barcode || ""].join(" ").toLowerCase();
          return hay.includes(q);
        });
      },

      categories() {
        const set = new Set(this.products.map((p) => p.category).filter(Boolean));
        return Array.from(set);
      },

      addToCart(product) {
        const existing = this.cart.find((c) => c.productId === product.id);
        if (existing) {
          existing.qty += 1;
        } else {
          this.cart.unshift({ productId: product.id, name: product.name, price: Number(product.price) || 0, qty: 1 });
        }
      },

      inc(idx) { this.cart[idx].qty += 1; },
      dec(idx) { this.cart[idx].qty = Math.max(1, this.cart[idx].qty - 1); },
      remove(idx) { this.cart.splice(idx, 1); },

      subtotal() {
        return this.cart.reduce((sum, it) => sum + it.price * it.qty, 0);
      },
      discountAmount() {
        const sub = this.subtotal();
        if (this.discountType === "percent") return (sub * (Number(this.discountValue) || 0)) / 100;
        if (this.discountType === "amount") return Number(this.discountValue) || 0;
        return 0;
      },
      taxedAmount() {
        const sub = this.subtotal() - this.discountAmount();
        const pct = Number(this.taxPercent) || 0;
        return (sub * pct) / 100;
      },
      total() {
        return Math.max(0, this.subtotal() - this.discountAmount() + this.taxedAmount());
      },

      canCheckout() {
        if (this.cart.length === 0) return false;
        if (this.paymentMethod === "Cash") {
          const cash = Number(this.cashGiven) || 0;
          return cash >= this.total();
        }
        return true;
      },

      changeDue() {
        if (this.paymentMethod !== "Cash") return 0;
        const cash = Number(this.cashGiven) || 0;
        return Math.max(0, cash - this.total());
      },

      finalizeSale() {
        this.paymentError = "";
        if (this.cart.length === 0) {
          this.paymentError = "Cart is empty.";
          return;
        }
        if (this.paymentMethod === "Cash") {
          const cash = Number(this.cashGiven) || 0;
          if (cash < this.total()) {
            this.paymentError = "Insufficient cash.";
            return;
          }
        }

        // Create sale record
        const saleId = `SALE-${Date.now()}`;
        const sale = {
          id: saleId,
          createdAt: new Date().toISOString(),
          items: this.cart.map((it) => ({ ...it, lineTotal: Number(it.price) * Number(it.qty) })),
          subtotal: this.subtotal(),
          discountType: this.discountType,
          discountValue: Number(this.discountValue) || 0,
          discountAmount: this.discountAmount(),
          taxPercent: Number(this.taxPercent) || 0,
          taxAmount: this.taxedAmount(),
          total: this.total(),
          paymentMethod: this.paymentMethod,
          cashGiven: this.paymentMethod === "Cash" ? (Number(this.cashGiven) || 0) : null,
          change: this.paymentMethod === "Cash" ? this.changeDue() : null,
          refunded: false,
        };

        // Deduct ingredients
        const ingredientMap = this.ingredients.reduce((acc, it) => { acc[it.name] = it; return acc; }, {});
        for (const it of sale.items) {
          const product = this.products.find((p) => p.id === it.productId);
          if (!product || !Array.isArray(product.recipe)) continue;
          for (const recipe of product.recipe) {
            const ing = ingredientMap[recipe.ingredientName];
            if (!ing) continue;
            const deduct = Number(recipe.quantity) * Number(it.qty);
            const current = Number(ing.availableQuantity) || 0;
            ing.availableQuantity = Math.max(0, current - deduct);
          }
        }

        // Save updated ingredients and products status
        this.ingredients = Object.values(ingredientMap);
        this._refreshProductStatuses();

        // Save sale
        this.sales.unshift(sale);
        this._save();

        // Reset cart
        this.cart = [];
        this.discountType = "none";
        this.discountValue = 0;
        this.taxPercent = 0;
        this.cashGiven = "";
      },

      printSale(sale) {
        const rows = sale.items.map((it) => `<tr><td>${it.name} x${it.qty}</td><td style='text-align:right'>${formatCurrency(it.lineTotal)}</td></tr>`).join("");
        const html = `
          <h2>Terry & Perry POS</h2>
          <div class='muted'>${new Date(sale.createdAt).toLocaleString()}</div>
          <div class='muted'>Receipt: ${sale.id}</div>
          <table>${rows}</table>
          <table class='totals'>
            <tr><td>Subtotal</td><td style='text-align:right'>${formatCurrency(sale.subtotal)}</td></tr>
            ${sale.discountAmount ? `<tr><td>Discount</td><td style='text-align:right'>- ${formatCurrency(sale.discountAmount)}</td></tr>` : ''}
            ${sale.taxAmount ? `<tr><td>Tax</td><td style='text-align:right'>${formatCurrency(sale.taxAmount)}</td></tr>` : ''}
            <tr><td><strong>Total</strong></td><td style='text-align:right'><strong>${formatCurrency(sale.total)}</strong></td></tr>
            <tr><td>Payment</td><td style='text-align:right'>${sale.paymentMethod}</td></tr>
            ${sale.cashGiven != null ? `<tr><td>Cash</td><td style='text-align:right'>${formatCurrency(sale.cashGiven)}</td></tr>` : ''}
            ${sale.change != null ? `<tr><td>Change</td><td style='text-align:right'>${formatCurrency(sale.change)}</td></tr>` : ''}
          </table>
          <p class='muted'>Thank you!</p>
        `;
        openPrintWindow(html);
      },

      refundSale(sale) {
        if (sale.refunded) return;
        // Add back ingredients
        const ingredientMap = this.ingredients.reduce((acc, it) => { acc[it.name] = it; return acc; }, {});
        for (const it of sale.items) {
          const product = this.products.find((p) => p.id === it.productId);
          if (!product || !Array.isArray(product.recipe)) continue;
          for (const recipe of product.recipe) {
            const ing = ingredientMap[recipe.ingredientName];
            if (!ing) continue;
            const addBack = Number(recipe.quantity) * Number(it.qty);
            const current = Number(ing.availableQuantity) || 0;
            ing.availableQuantity = current + addBack;
          }
        }
        this.ingredients = Object.values(ingredientMap);
        sale.refunded = true;
        sale.refundedAt = new Date().toISOString();
        this._refreshProductStatuses();
      },
    };
  }

  // Expose factory globally for x-data usage in HTML
  window.posApp = posApp;
})();


