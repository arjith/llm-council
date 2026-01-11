import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Clock,
  MessageSquare,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Vote,
  Users,
  AlertTriangle,
  XCircle,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineEventProps {
  type: string;
  stage?: string;
  memberName?: string;
  timestamp: string;
  relativeTime: number; // ms from start
  durationMs?: number;
  data?: Record<string, unknown>;
  content?: string;
  confidence?: number;
  tokenCount?: number;
}

const eventTypeConfig: Record<string, {
  icon: React.ReactNode;
  color: string;
  label: string;
}> = {
  'session-start': {
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-green-400 bg-green-500/10 border-green-500/30',
    label: 'session-start',
  },
  'session-end': {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-green-400 bg-green-500/10 border-green-500/30',
    label: 'session-end',
  },
  'stage-start': {
    icon: <ChevronRight className="w-4 h-4" />,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    label: 'stage-start',
  },
  'stage-end': {
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    label: 'stage-end',
  },
  'member-request': {
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    label: 'request',
  },
  'member-response': {
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    label: 'response',
  },
  'vote-cast': {
    icon: <Vote className="w-4 h-4" />,
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    label: 'vote',
  },
  'voting-complete': {
    icon: <Vote className="w-4 h-4" />,
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    label: 'voting-complete',
  },
  'correction-triggered': {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    label: 'correction',
  },
  'backup-activated': {
    icon: <Users className="w-4 h-4" />,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    label: 'backup',
  },
  'error': {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-400 bg-red-500/10 border-red-500/30',
    label: 'error',
  },
};

export function TimelineEvent({
  type,
  stage,
  memberName,
  relativeTime,
  durationMs,
  data,
  content,
  confidence,
  tokenCount,
}: TimelineEventProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const config = eventTypeConfig[type] ?? {
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    label: type,
  };

  const hasExpandableContent = content || (data && Object.keys(data).length > 0);

  const handleCopy = async () => {
    const textToCopy = content || JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format relative time
  const formatTime = (ms: number) => {
    const seconds = ms / 1000;
    return `+${seconds.toFixed(2)}s`;
  };

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-all',
      config.color,
      hasExpandableContent && 'cursor-pointer hover:border-opacity-60'
    )}>
      <div 
        className="flex items-center gap-3"
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        {/* Time */}
        <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-500">
          {formatTime(relativeTime)}
        </div>

        {/* Icon */}
        <div className="w-7 h-7 rounded-md bg-gray-800/80 flex items-center justify-center flex-shrink-0">
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{config.label}</span>
            {stage && (
              <span className="px-2 py-0.5 rounded bg-gray-700/50 text-xs text-gray-300">
                → {stage}
              </span>
            )}
            {memberName && (
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-xs text-purple-300">
                {memberName}
              </span>
            )}
            {confidence !== undefined && (
              <span className={cn(
                'px-2 py-0.5 rounded text-xs',
                confidence >= 0.7 ? 'bg-green-500/20 text-green-300' :
                confidence >= 0.5 ? 'bg-yellow-500/20 text-yellow-300' :
                'bg-red-500/20 text-red-300'
              )}>
                {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
          
          {/* Stats */}
          {(durationMs !== undefined || tokenCount !== undefined) && (
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {durationMs !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {durationMs}ms
                </span>
              )}
              {tokenCount !== undefined && (
                <span>{tokenCount} tokens</span>
              )}
            </div>
          )}
        </div>

        {/* Expand Button */}
        {hasExpandableContent && (
          <button className="p-1 hover:bg-gray-700/50 rounded flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && hasExpandableContent && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          {content && (
            <div className="relative">
              <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900/50 rounded-lg p-3 pr-10">
                {content}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="absolute top-2 right-2 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
          {data && Object.keys(data).length > 0 && (
            <div className="relative">
              <pre className="text-xs text-gray-300 overflow-x-auto bg-gray-900/50 rounded-lg p-3 pr-10">
                {JSON.stringify(data, null, 2)}
              </pre>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="absolute top-2 right-2 p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
