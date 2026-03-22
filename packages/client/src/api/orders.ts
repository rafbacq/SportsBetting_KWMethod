import { api } from './client';
import type { Order, PlaceOrderParams, PaginatedResult, Platform } from '@sports-betting/shared';

export async function placeOrder(params: PlaceOrderParams): Promise<Order> {
  const { data } = await api.post('/orders', params);
  return data;
}

export async function cancelOrder(orderId: string, platform: Platform): Promise<void> {
  await api.delete(`/orders/${orderId}`, { params: { platform } });
}

export async function fetchOrders(platform: Platform): Promise<PaginatedResult<Order>> {
  const { data } = await api.get('/orders', { params: { platform } });
  return data;
}
