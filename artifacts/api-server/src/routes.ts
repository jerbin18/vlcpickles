import { Router } from "express";

const router = Router();

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  weight: string;
  description: string;
  story: string;
  ingredients: string;
  stock: number;
  badge: string;
};

type OrderItemRequest = {
  productId: string;
  quantity: number;
};

type Customer = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  createdAt: string;
  status: "draft" | "confirmed" | "packed";
  customer: Customer;
  items: OrderItem[];
  total: number;
};

// ----------------------------------------------------
// Temporary development data
// ----------------------------------------------------

let products: Product[] = [
  {
    id: "tuna-fish",
    name: "Tuna Fish Pickle",
    category: "Fish",
    price: 320,
    weight: "250 g",
    description:
      "Tender tuna pieces, toasted spices, and a bright homemade masala.",
    story:
      "Our first jar and the one that started the Sunday lunch arguments.",
    ingredients:
      "Tuna, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
    stock: 18,
    badge: "The original",
  },
  {
    id: "prawns",
    name: "Prawns Pickle",
    category: "Shellfish",
    price: 360,
    weight: "250 g",
    description:
      "Juicy prawns folded into a sticky, fiery coastal masala.",
    story:
      "Small-batch prawns cooked until they catch the masala at every edge.",
    ingredients:
      "Prawns, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
    stock: 12,
    badge: "Family favourite",
  },
  {
    id: "squid",
    name: "Squid Pickle",
    category: "Shellfish",
    price: 340,
    weight: "250 g",
    description:
      "Carefully prepared squid with a tender bite and a savoury spice finish.",
    story:
      "Cleaned by hand, cooked patiently.",
    ingredients:
      "Squid, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
    stock: 9,
    badge: "Limited batch",
  },
  {
    id: "nethili",
    name: "Nethili Pickle",
    category: "Fish",
    price: 290,
    weight: "250 g",
    description:
      "Traditional anchovy pickle with tiny fish, big flavour, and a gentle tang.",
    story:
      "A nostalgic coastal recipe with enough heat for curd rice.",
    ingredients:
      "Nethili, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
    stock: 24,
    badge: "Coastal classic",
  },
];

let orders: Order[] = [];

let whatsappPhone = "";

// ----------------------------------------------------
// PRODUCTS
// ----------------------------------------------------

router.get("/products", (_req, res) => {
  res.json(products);
});

router.post("/products", (req, res) => {
  const product = req.body as Product;

  if (!product.name) {
    return res.status(400).json({
      error: "Product name is required",
    });
  }

  const newProduct: Product = {
    ...product,
    id: product.id || `product-${Date.now()}`,
  };

  products.push(newProduct);

  return res.status(201).json(newProduct);
});

router.patch("/products/:id", (req, res) => {
  const { id } = req.params;

  const index = products.findIndex((product) => product.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: "Product not found",
    });
  }

  products[index] = {
    ...products[index],
    ...req.body,
    id,
  };

  return res.json(products[index]);
});

router.delete("/products/:id", (req, res) => {
  const { id } = req.params;

  const exists = products.some((product) => product.id === id);

  if (!exists) {
    return res.status(404).json({
      error: "Product not found",
    });
  }

  products = products.filter((product) => product.id !== id);

  return res.status(204).send();
});

// ----------------------------------------------------
// ORDERS
// ----------------------------------------------------

router.get("/orders", (_req, res) => {
  res.json(orders);
});

router.post("/orders", (req, res) => {
  const { customer, items } = req.body as {
    customer: Customer;
    items: OrderItemRequest[];
  };

  if (!customer) {
    return res.status(400).json({
      error: "Customer information is required",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "At least one product is required",
    });
  }

  const orderItems: OrderItem[] = [];

  for (const item of items) {
    const product = products.find(
      (product) => product.id === item.productId,
    );

    if (!product) {
      return res.status(404).json({
        error: `Product not found: ${item.productId}`,
      });
    }

    if (item.quantity <= 0) {
      return res.status(400).json({
        error: "Quantity must be greater than zero",
      });
    }

    if (product.stock < item.quantity) {
      return res.status(400).json({
        error: `${product.name} has only ${product.stock} available`,
      });
    }

    orderItems.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      price: product.price,
    });
  }

  const total = orderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  // Reduce stock
  for (const item of items) {
    const product = products.find(
      (product) => product.id === item.productId,
    );

    if (product) {
      product.stock -= item.quantity;
    }
  }

  const order: Order = {
    id: `VLC-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "draft",
    customer,
    items: orderItems,
    total,
  };

  orders.unshift(order);

  return res.status(201).json(order);
});

router.patch("/orders/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body as {
    status: Order["status"];
  };

  const order = orders.find((order) => order.id === id);

  if (!order) {
    return res.status(404).json({
      error: "Order not found",
    });
  }

  if (!["draft", "confirmed", "packed"].includes(status)) {
    return res.status(400).json({
      error: "Invalid order status",
    });
  }

  order.status = status;

  return res.json(order);
});

// ----------------------------------------------------
// WHATSAPP SETTINGS
// ----------------------------------------------------

router.get("/settings/whatsapp", (_req, res) => {
  res.json({
    phone: whatsappPhone,
  });
});

router.put("/settings/whatsapp", (req, res) => {
  const { phone } = req.body as {
    phone?: string;
  };

  if (typeof phone !== "string") {
    return res.status(400).json({
      error: "Phone number is required",
    });
  }

  whatsappPhone = phone;

  return res.json({
    phone: whatsappPhone,
  });
});

// ----------------------------------------------------
// HEALTH
// ----------------------------------------------------

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

export default router;