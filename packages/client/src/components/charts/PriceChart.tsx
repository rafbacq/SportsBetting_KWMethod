import { useEffect, useRef } from 'react';
import { createChart, type IChartApi, ColorType } from 'lightweight-charts';
import type { PricePoint } from '@sports-betting/shared';

interface PriceChartProps {
  data: PricePoint[];
  height?: number;
}

export function PriceChart({ data, height = 300 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(59,130,246,0.3)', width: 1 },
        horzLine: { color: 'rgba(59,130,246,0.3)', width: 1 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
      },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: 'rgba(59,130,246,0.3)',
      bottomColor: 'rgba(59,130,246,0.01)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `${price}¢`,
      },
    });

    const chartData = data
      .map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as never,
        value: p.yesPrice,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (chartData.length > 0) {
      areaSeries.setData(chartData);
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-surface-2/50 rounded-lg" style={{ height }}>
        <p className="text-gray-500 text-sm">No price history available</p>
      </div>
    );
  }

  return <div ref={containerRef} className="rounded-lg overflow-hidden" />;
}
