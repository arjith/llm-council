import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  value: number; // 0-1 or 0-100
  showTrend?: boolean;
  trendDelta?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceBadge({ 
  value, 
  showTrend, 
  trendDelta,
  size = 'md',
  className 
}: ConfidenceBadgeProps) {
  // Normalize to percentage
  const percentage = value > 1 ? value : value * 100;
  
  // Determine color based on confidence level
  const getColor = (pct: number) => {
    if (pct >= 85) return 'text-green-400 bg-green-500/20';
    if (pct >= 70) return 'text-emerald-400 bg-emerald-500/20';
    if (pct >= 50) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-lg px-4 py-2 font-semibold',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      getColor(percentage),
      sizeClasses[size],
      className
    )}>
      <span>{percentage.toFixed(0)}%</span>
      {showTrend && trendDelta !== undefined && trendDelta !== 0 && (
        <span className={cn(
          'text-xs',
          trendDelta > 0 ? 'text-green-400' : 'text-red-400'
        )}>
          {trendDelta > 0 ? '↑' : '↓'} {Math.abs(trendDelta).toFixed(0)}%
        </span>
      )}
    </span>
  );
}

interface ConfidenceBarProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ value, showLabel = true, className }: ConfidenceBarProps) {
  const percentage = value > 1 ? value : value * 100;
  
  const getColor = (pct: number) => {
    if (pct >= 85) return 'bg-green-500';
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={cn('h-full transition-all duration-500', getColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400 min-w-[3ch]">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
