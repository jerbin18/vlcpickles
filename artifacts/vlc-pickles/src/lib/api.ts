export type ApiCustomer = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

export type ApiOrderItem = {
  productId: string;
  quantity: number;
};

export type ApiProduct = {
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

export type ApiOrder = {
  id: string;
  createdAt: string;
  status: 'draft' | 'confirmed' | 'packed';
  customer: ApiCustomer;
  items: { productId: string; name: string; quantity: number; price: number }[];
  total: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/vlc-api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  products: () => request<ApiProduct[]>('/products'),
  orders: () => request<ApiOrder[]>('/orders'),
  whatsapp: () => request<{ phone: string }>('/settings/whatsapp'),
  createProduct: (product: unknown) =>
    request<ApiProduct>('/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id: string, product: unknown) =>
    request<ApiProduct>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(product) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  createOrder: (customer: ApiCustomer, items: ApiOrderItem[]) =>
    request<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify({ customer, items }) }),
  updateOrder: (id: string, status: string) =>
    request<ApiOrder>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  saveWhatsapp: (phone: string) =>
    request<{ phone: string }>('/settings/whatsapp', {
      method: 'PUT',
      body: JSON.stringify({ phone }),
    }),
};