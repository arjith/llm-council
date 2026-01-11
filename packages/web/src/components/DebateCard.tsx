import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBadge } from './ConfidenceBadge';

interface DebateCardProps {
  memberId: string;
  memberName: string;
  role: string;
  content: string;
  confidence?: number;
  latencyMs?: number;
  tokenCount?: number;
  keyPoints?: string[];
  agreesWithMembers?: string[];
  challengesMembers?: string[];
  changedPosition?: boolean;
  previousPosition?: string;
}

const roleColors: Record<string, string> = {
  'opinion-giver': 'border-l-blue-500 bg-blue-500/5',
  'reviewer': 'border-l-purple-500 bg-purple-500/5',
  'synthesizer': 'border-l-emerald-500 bg-emerald-500/5',
  "devil's-advocate": 'border-l-red-500 bg-red-500/5',
  'fact-checker': 'border-l-amber-500 bg-amber-500/5',
  'skeptic': 'border-l-orange-500 bg-orange-500/5',
};

const roleEmojis: Record<string, string> = {
  'opinion-giver': '🔵',
  'reviewer': '🟣',
  'synthesizer': '🟢',
  "devil's-advocate": '🔴',
  'fact-checker': '🟡',
  'skeptic': '🟠',
};

export function DebateCard({
  memberName,
  role,
  content,
  confidence,
  latencyMs,
  tokenCount,
  keyPoints,
  agreesWithMembers,
  challengesMembers,
  changedPosition,
  previousPosition,
}: DebateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const roleKey = role.toLowerCase().replace(/\s+/g, '-');
  const cardColor = roleColors[roleKey] ?? 'border-l-gray-500 bg-gray-500/5';
  const emoji = roleEmojis[roleKey] ?? '⚪';
  
  // Truncate content for collapsed view
  const maxLength = 300;
  const isLong = content.length > maxLength;
  const displayContent = isExpanded ? content : content.slice(0, maxLength);

  return (
    <div className={cn(
      'rounded-xl border border-gray-700/50 border-l-4 p-5 transition-all hover:border-gray-600/50',
      cardColor
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">{emoji}</span>
          <div>
            <span className="font-semibold text-white">{memberName}</span>
            <span className="text-gray-400 ml-2 text-sm">({role})</span>
          </div>
        </div>
        {confidence !== undefined && (
          <ConfidenceBadge value={confidence} />
        )}
      </div>

      {/* Changed Position Indicator */}
      {changedPosition && (
        <div className="flex items-center gap-2 mb-3 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          <RefreshCw className="w-4 h-4" />
          <span>Changed position from Round {previousPosition ?? 'previous'}</span>
        </div>
      )}

      {/* Content */}
      <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
        {displayContent}
        {isLong && !isExpanded && '...'}
      </div>

      {/* Key Points */}
      {keyPoints && keyPoints.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {keyPoints.map((point, idx) => (
            <span 
              key={idx}
              className="px-2 py-1 rounded-md bg-gray-800 text-xs text-gray-300 border border-gray-700"
            >
              💡 {point}
            </span>
          ))}
        </div>
      )}

      {/* Agreement/Challenge Indicators */}
      {(agreesWithMembers?.length || challengesMembers?.length) && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          {agreesWithMembers && agreesWithMembers.length > 0 && (
            <div className="flex items-center gap-1 text-green-400">
              <span>⚖️ Agrees with:</span>
              <span className="text-gray-400">{agreesWithMembers.join(', ')}</span>
            </div>
          )}
          {challengesMembers && challengesMembers.length > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <span>⚔️ Challenges:</span>
              <span className="text-gray-400">{challengesMembers.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer: Expand/Collapse + Stats */}
      <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {latencyMs !== undefined && (
            <span>⏱️ {(latencyMs / 1000).toFixed(2)}s</span>
          )}
          {tokenCount !== undefined && (
            <span>📊 {tokenCount} tokens</span>
          )}
        </div>
        
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-council-primary hover:text-council-secondary transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Show more</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
