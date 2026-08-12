"""VLC Pickles Python backend.

This small standard-library service keeps the first version easy to run:
products, stock, orders, and WhatsApp settings are stored in SQLite.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "vlc_pickles.sqlite3"
BASE_PATH = "/vlc-api"

SEED_PRODUCTS = [
    {
        "id": "tuna-fish",
        "name": "Tuna Fish Pickle",
        "category": "Fish",
        "price": 320,
        "weight": "250 g",
        "description": "Tender tuna pieces, toasted spices, and a bright homemade masala.",
        "story": "Our first jar and the one that started the Sunday lunch arguments. Deep, savoury and warming.",
        "ingredients": "Tuna, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
        "stock": 18,
        "badge": "The original",
    },
    {
        "id": "prawns",
        "name": "Prawns Pickle",
        "category": "Shellfish",
        "price": 360,
        "weight": "250 g",
        "description": "Juicy prawns folded into a sticky, fiery coastal masala.",
        "story": "Small-batch prawns cooked until they catch the masala at every edge. A proper rice companion.",
        "ingredients": "Prawns, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
        "stock": 12,
        "badge": "Family favourite",
    },
    {
        "id": "squid",
        "name": "Squid Pickle",
        "category": "Shellfish",
        "price": 340,
        "weight": "250 g",
        "description": "Carefully prepared squid with a tender bite and a savoury spice finish.",
        "story": "Cleaned by hand, cooked patiently. The jar for people who know exactly what they like.",
        "ingredients": "Squid, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
        "stock": 9,
        "badge": "Limited batch",
    },
    {
        "id": "nethili",
        "name": "Nethili Pickle",
        "category": "Fish",
        "price": 290,
        "weight": "250 g",
        "description": "Traditional anchovy pickle with tiny fish, big flavour, and a gentle tang.",
        "story": "A nostalgic coastal recipe with enough heat for curd rice and enough depth for everything else.",
        "ingredients": "Nethili, gingelly oil, chilli, garlic, ginger, curry leaves, vinegar, house spices.",
        "stock": 24,
        "badge": "Coastal classic",
    },
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def open_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_db() -> None:
    with open_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL CHECK(price >= 0),
                weight TEXT NOT NULL,
                description TEXT NOT NULL,
                story TEXT NOT NULL,
                ingredients TEXT NOT NULL,
                stock INTEGER NOT NULL CHECK(stock >= 0),
                badge TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('draft', 'confirmed', 'packed')),
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_address TEXT NOT NULL,
                customer_note TEXT NOT NULL,
                total INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id TEXT NOT NULL,
                name TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK(quantity > 0),
                price INTEGER NOT NULL CHECK(price >= 0)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        existing = connection.execute("SELECT COUNT(*) AS count FROM products").fetchone()["count"]
        if existing == 0:
            connection.executemany(
                """
                INSERT INTO products
                (id, name, category, price, weight, description, story, ingredients, stock, badge)
                VALUES (:id, :name, :category, :price, :weight, :description, :story, :ingredients, :stock, :badge)
                """,
                SEED_PRODUCTS,
            )


def product_from_row(row: sqlite3.Row) -> dict[str, Any]:
    return dict(row)


def order_from_row(connection: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    items = connection.execute(
        "SELECT product_id, name, quantity, price FROM order_items WHERE order_id = ?",
        (row["id"],),
    ).fetchall()
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "status": row["status"],
        "customer": {
            "name": row["customer_name"],
            "phone": row["customer_phone"],
            "address": row["customer_address"],
            "note": row["customer_note"],
        },
        "items": [
            {
                "productId": item["product_id"],
                "name": item["name"],
                "quantity": item["quantity"],
                "price": item["price"],
            }
            for item in items
        ],
        "total": row["total"],
    }


def clean_product(payload: dict[str, Any], product_id: str | None = None) -> dict[str, Any]:
    name = str(payload.get("name", "")).strip()
    if not name:
        raise ValueError("Product name is required")
    slug = product_id or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if not slug:
        raise ValueError("Product name must contain letters or numbers")
    product = {
        "id": slug,
        "name": name,
        "category": str(payload.get("category", "Special batch")).strip() or "Special batch",
        "price": max(0, int(payload.get("price", 0))),
        "weight": str(payload.get("weight", "250 g")).strip() or "250 g",
        "description": str(payload.get("description", "")).strip(),
        "story": str(payload.get("story", "")).strip(),
        "ingredients": str(payload.get("ingredients", "")).strip(),
        "stock": max(0, int(payload.get("stock", 0))),
        "badge": str(payload.get("badge", "Small batch")).strip() or "Small batch",
    }
    if not product["description"] or not product["ingredients"]:
        raise ValueError("Description and ingredients are required")
    return product


class Handler(BaseHTTPRequestHandler):
    server_version = "VLC-Pickles-Python/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8") or "{}")
        if not isinstance(value, dict):
            raise ValueError("Request body must be an object")
        return value

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        try:
            with open_db() as connection:
                if path == f"{BASE_PATH}/healthz":
                    self.send_json(200, {"status": "ok", "language": "python"})
                elif path == f"{BASE_PATH}/products":
                    rows = connection.execute("SELECT * FROM products ORDER BY name").fetchall()
                    self.send_json(200, [product_from_row(row) for row in rows])
                elif path == f"{BASE_PATH}/orders":
                    rows = connection.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
                    self.send_json(200, [order_from_row(connection, row) for row in rows])
                elif path == f"{BASE_PATH}/settings/whatsapp":
                    row = connection.execute("SELECT value FROM settings WHERE key = 'whatsapp'").fetchone()
                    self.send_json(200, {"phone": row["value"] if row else ""})
                else:
                    self.send_json(404, {"error": "Not found"})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error"})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            with open_db() as connection:
                if path == f"{BASE_PATH}/products":
                    product = clean_product(payload)
                    connection.execute(
                        """
                        INSERT INTO products
                        (id, name, category, price, weight, description, story, ingredients, stock, badge)
                        VALUES (:id, :name, :category, :price, :weight, :description, :story, :ingredients, :stock, :badge)
                        """,
                        product,
                    )
                    self.send_json(201, product)
                elif path == f"{BASE_PATH}/orders":
                    self.create_order(connection, payload)
                else:
                    self.send_json(404, {"error": "Not found"})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "A product with this id already exists"})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error"})

    def create_order(self, connection: sqlite3.Connection, payload: dict[str, Any]) -> None:
        customer = payload.get("customer")
        items = payload.get("items")
        if not isinstance(customer, dict) or not all(str(customer.get(field, "")).strip() for field in ("name", "phone", "address")):
            raise ValueError("Name, phone, and address are required")
        if not isinstance(items, list) or not items:
            raise ValueError("At least one product is required")
        resolved_items: list[dict[str, Any]] = []
        for requested in items:
            product_id = str(requested.get("productId", ""))
            quantity = int(requested.get("quantity", 0))
            if not product_id or quantity < 1:
                raise ValueError("Each order item needs a product and positive quantity")
            product = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
            if not product:
                raise ValueError(f"Product not found: {product_id}")
            if product["stock"] < quantity:
                raise ValueError(f"Not enough stock for {product['name']}")
            resolved_items.append({"product": product, "quantity": quantity})
        order_id = f"VLC-{datetime.now(timezone.utc).strftime('%H%M%S%f')[-7:]}"
        total = sum(item["product"]["price"] * item["quantity"] for item in resolved_items)
        connection.execute(
            """
            INSERT INTO orders
            (id, created_at, status, customer_name, customer_phone, customer_address, customer_note, total)
            VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)
            """,
            (
                order_id,
                now_iso(),
                str(customer["name"]).strip(),
                str(customer["phone"]).strip(),
                str(customer["address"]).strip(),
                str(customer.get("note", "")).strip(),
                total,
            ),
        )
        for item in resolved_items:
            product = item["product"]
            quantity = item["quantity"]
            connection.execute(
                "INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)",
                (order_id, product["id"], product["name"], quantity, product["price"]),
            )
            connection.execute("UPDATE products SET stock = stock - ? WHERE id = ?", (quantity, product["id"]))
        row = connection.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        self.send_json(201, order_from_row(connection, row))

    def do_PATCH(self) -> None:
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            with open_db() as connection:
                if path.startswith(f"{BASE_PATH}/products/"):
                    product_id = path.removeprefix(f"{BASE_PATH}/products/")
                    existing = connection.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
                    if not existing:
                        self.send_json(404, {"error": "Product not found"})
                        return
                    merged = {**product_from_row(existing), **payload}
                    updated = clean_product(merged, product_id)
                    connection.execute(
                        """
                        UPDATE products SET name=:name, category=:category, price=:price, weight=:weight,
                        description=:description, story=:story, ingredients=:ingredients, stock=:stock, badge=:badge
                        WHERE id=:id
                        """,
                        updated,
                    )
                    self.send_json(200, updated)
                elif path.startswith(f"{BASE_PATH}/orders/"):
                    order_id = path.removeprefix(f"{BASE_PATH}/orders/")
                    status = str(payload.get("status", ""))
                    if status not in {"draft", "confirmed", "packed"}:
                        raise ValueError("Invalid order status")
                    cursor = connection.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
                    if cursor.rowcount == 0:
                        self.send_json(404, {"error": "Order not found"})
                        return
                    row = connection.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
                    self.send_json(200, order_from_row(connection, row))
                else:
                    self.send_json(404, {"error": "Not found"})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error"})

    def do_PUT(self) -> None:
        path = urlparse(self.path).path
        if path != f"{BASE_PATH}/settings/whatsapp":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            payload = self.read_json()
            phone = re.sub(r"\D", "", str(payload.get("phone", "")))
            with open_db() as connection:
                connection.execute(
                    "INSERT INTO settings (key, value) VALUES ('whatsapp', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (phone,),
                )
            self.send_json(200, {"phone": phone})
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path
        if not path.startswith(f"{BASE_PATH}/products/"):
            self.send_json(404, {"error": "Not found"})
            return
        product_id = path.removeprefix(f"{BASE_PATH}/products/")
        try:
            with open_db() as connection:
                cursor = connection.execute("DELETE FROM products WHERE id = ?", (product_id,))
            if cursor.rowcount == 0:
                self.send_json(404, {"error": "Product not found"})
            else:
                self.send_json(204, {})
        except sqlite3.Error:
            self.send_json(500, {"error": "Database error"})


def main() -> None:
    initialize_db()
    port = int(os.environ.get("PORT", "22187"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"VLC Pickles Python API listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()