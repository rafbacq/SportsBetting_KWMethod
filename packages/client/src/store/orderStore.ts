import { create } from 'zustand';
import type { OrderSide, OrderAction, OrderType } from '@sports-betting/shared';

interface OrderFormState {
  isOpen: boolean;
  marketId: string;
  marketTicker: string;
  marketTitle: string;
  side: OrderSide;
  action: OrderAction;
  type: OrderType;
  price: number;
  quantity: number;

  openBetSlip: (params: {
    marketId: string;
    marketTicker: string;
    marketTitle: string;
    side?: OrderSide;
    action?: OrderAction;
    price?: number;
    quantity?: number;
  }) => void;
  closeBetSlip: () => void;
  setSide: (side: OrderSide) => void;
  setAction: (action: OrderAction) => void;
  setType: (type: OrderType) => void;
  setPrice: (price: number) => void;
  setQuantity: (quantity: number) => void;
}

export const useOrderStore = create<OrderFormState>((set) => ({
  isOpen: false,
  marketId: '',
  marketTicker: '',
  marketTitle: '',
  side: 'yes',
  action: 'buy',
  type: 'limit',
  price: 50,
  quantity: 1,

  openBetSlip: (params) =>
    set({
      isOpen: true,
      marketId: params.marketId,
      marketTicker: params.marketTicker,
      marketTitle: params.marketTitle,
      side: params.side || 'yes',
      action: params.action || 'buy',
      price: params.price || 50,
      quantity: params.quantity || 1,
    }),

  closeBetSlip: () => set({ isOpen: false }),
  setSide: (side) => set({ side }),
  setAction: (action) => set({ action }),
  setType: (type) => set({ type }),
  setPrice: (price) => set({ price }),
  setQuantity: (quantity) => set({ quantity }),
}));
