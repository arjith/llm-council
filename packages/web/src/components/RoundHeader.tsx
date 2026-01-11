import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from './ConfidenceBadge';

interface RoundHeaderProps {
  roundNumber: number;
  label?: string;
  confidence: number;
  previousConfidence?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  isLatest?: boolean;
  duration?: number; // in ms
}

export function RoundHeader({
  roundNumber,
  label,
  confidence,
  previousConfidence,
  isExpanded = true,
  onToggle,
  isLatest = false,
  duration,
}: RoundHeaderProps) {
  const trendDelta = previousConfidence !== undefined 
    ? (confidence - previousConfidence) * 100 
    : undefined;

  return (
    <div 
      className={cn(
        'flex items-center justify-between py-3 px-4 rounded-lg cursor-pointer transition-all',
        isLatest 
          ? 'bg-gradient-to-r from-council-primary/20 to-council-secondary/20 border border-council-primary/30' 
          : 'bg-gray-800/50 border border-gray-700/50 hover:border-gray-600/50'
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-4">
        {/* Round Number Badge */}
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
          isLatest 
            ? 'bg-council-primary text-white' 
            : 'bg-gray-700 text-gray-300'
        )}>
          {roundNumber}
        </div>
        
        {/* Title */}
        <div>
          <h3 className={cn(
            'font-semibold',
            isLatest ? 'text-white' : 'text-gray-300'
          )}>
            ROUND {roundNumber}
            {label && <span className="font-normal text-gray-400 ml-2">• {label}</span>}
          </h3>
          {duration !== undefined && (
            <p className="text-xs text-gray-500">
              {(duration / 1000).toFixed(1)}s duration
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Confidence with Trend */}
        <div className="text-right">
          <ConfidenceBadge 
            value={confidence} 
            showTrend={trendDelta !== undefined}
            trendDelta={trendDelta}
            size="md"
          />
          {trendDelta !== undefined && trendDelta > 0 && (
            <p className="text-xs text-green-400 mt-1">
              ↑ +{trendDelta.toFixed(0)}% from Round {roundNumber - 1}
            </p>
          )}
        </div>

        {/* Expand/Collapse Icon */}
        {onToggle && (
          <div className={cn(
            'p-1 rounded transition-colors',
            isLatest ? 'hover:bg-white/10' : 'hover:bg-gray-700'
          )}>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
