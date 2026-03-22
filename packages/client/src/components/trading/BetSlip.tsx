import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrderStore } from '@/store/orderStore';
import { usePlatformStore } from '@/store/platformStore';
import { placeOrder } from '@/api/orders';
import { centsToDollars } from '@sports-betting/shared';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';

export function BetSlip() {
  const queryClient = useQueryClient();
  const platform = usePlatformStore((s) => s.activePlatform);
  const {
    isOpen,
    closeBetSlip,
    marketId,
    marketTicker,
    marketTitle,
    side,
    action,
    type,
    price,
    quantity,
    setSide,
    setAction,
    setType,
    setPrice,
    setQuantity,
  } = useOrderStore();

  const [showConfirm, setShowConfirm] = useState(false);

  const estimatedCost = (price * quantity) / 100;
  const potentialPayout = quantity - estimatedCost;

  const mutation = useMutation({
    mutationFn: () =>
      placeOrder({
        platform,
        marketId,
        marketTicker,
        side,
        action,
        type,
        price,
        quantity,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      setShowConfirm(false);
      closeBetSlip();
    },
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Slide-in panel */}
      <div className="fixed right-0 top-16 bottom-0 w-80 bg-surface-1 border-l border-white/5 z-30 overflow-y-auto shadow-2xl">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">
              {action === 'buy' ? 'Place Bet' : 'Sell Position'}
            </h3>
            <button onClick={closeBetSlip} className="text-gray-400 hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Market title */}
          <p className="text-xs text-gray-400 mb-4 line-clamp-2">{marketTitle}</p>

          {/* Action toggle */}
          <div className="flex gap-1 mb-4 bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setAction('buy')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                action === 'buy' ? 'bg-brand-600 text-white' : 'text-gray-400'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setAction('sell')}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                action === 'sell' ? 'bg-brand-600 text-white' : 'text-gray-400'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Side toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSide('yes')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                side === 'yes'
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-surface-2 text-gray-400 border border-transparent'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setSide('no')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                side === 'no'
                  ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                  : 'bg-surface-2 text-gray-400 border border-transparent'
              }`}
            >
              No
            </button>
          </div>

          {/* Order type */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Order Type</label>
            <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
              <button
                onClick={() => setType('limit')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                  type === 'limit' ? 'bg-surface-3 text-white' : 'text-gray-400'
                }`}
              >
                Limit
              </button>
              <button
                onClick={() => setType('market')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                  type === 'market' ? 'bg-surface-3 text-white' : 'text-gray-400'
                }`}
              >
                Market
              </button>
            </div>
          </div>

          {/* Price */}
          {type === 'limit' && (
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Price (cents)</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={price}
                  onChange={(e) => setPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="input w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¢</span>
              </div>
              {/* Price slider */}
              <input
                type="range"
                min={1}
                max={99}
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value))}
                className="w-full mt-2 accent-brand-500"
              />
            </div>
          )}

          {/* Quantity */}
          <div className="mb-6">
            <label className="text-xs text-gray-500 mb-1 block">Contracts</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="input w-full"
            />
          </div>

          {/* Summary */}
          <div className="bg-surface-2 rounded-lg p-3 mb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Est. Cost</span>
              <span className="font-medium">{centsToDollars(price * quantity)}</span>
            </div>
            {action === 'buy' && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Potential Payout</span>
                <span className="font-medium text-emerald-400">
                  ${potentialPayout.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={() => setShowConfirm(true)}
            className={`w-full py-3 rounded-lg font-semibold text-sm transition-all ${
              side === 'yes'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            {action === 'buy' ? 'Buy' : 'Sell'} {side.toUpperCase()} @ {price}¢
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Order"
      >
        <div className="space-y-3 mb-4">
          <p className="text-sm text-gray-300">{marketTitle}</p>
          <div className="bg-surface-2 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Side</span>
              <span className={side === 'yes' ? 'text-emerald-400' : 'text-red-400'}>
                {side.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Action</span>
              <span>{action.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Price</span>
              <span>{price}¢</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Quantity</span>
              <span>{quantity}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between font-medium">
              <span className="text-gray-400">Total Cost</span>
              <span>{centsToDollars(price * quantity)}</span>
            </div>
          </div>
        </div>

        {mutation.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-400">{(mutation.error as Error).message}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              side === 'yes'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            } disabled:opacity-50`}
          >
            {mutation.isPending ? <Spinner size="sm" /> : 'Confirm'}
          </button>
        </div>
      </Modal>
    </>
  );
}
