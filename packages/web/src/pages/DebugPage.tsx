import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { 
  ArrowLeft, 
  ChevronRight,
  Clock,
  MessageSquare,
  Users,
  Vote,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TraceEvent {
  id: string;
  sessionId: string;
  type: string;
  stage?: string;
  memberId?: string;
  memberName?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  durationMs?: number;
  parentId?: string;
}

interface TracesResponse {
  sessionId: string;
  traces: TraceEvent[];
}

export function DebugPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery<TracesResponse>({
    queryKey: ['traces', id],
    queryFn: async () => {
      const res = await fetch(`/api/council/${id}/traces`);
      if (!res.ok) throw new Error('Traces not found');
      return res.json();
    },
  });

  const toggleExpanded = (traceId: string) => {
    const newExpanded = new Set(expandedTraces);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
    }
    setExpandedTraces(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-council-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Traces Not Found</h2>
        <Link to="/" className="text-council-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const traceTypeIcons: Record<string, React.ReactNode> = {
    'session-start': <Sparkles className="w-4 h-4 text-green-400" />,
    'session-end': <CheckCircle className="w-4 h-4 text-green-400" />,
    'stage-start': <ChevronRight className="w-4 h-4 text-blue-400" />,
    'stage-end': <CheckCircle className="w-4 h-4 text-blue-400" />,
    'member-request': <MessageSquare className="w-4 h-4 text-purple-400" />,
    'member-response': <MessageSquare className="w-4 h-4 text-purple-400" />,
    'vote-cast': <Vote className="w-4 h-4 text-yellow-400" />,
    'voting-complete': <Vote className="w-4 h-4 text-yellow-400" />,
    'correction-triggered': <AlertTriangle className="w-4 h-4 text-orange-400" />,
    'backup-activated': <Users className="w-4 h-4 text-orange-400" />,
    'error': <XCircle className="w-4 h-4 text-red-400" />,
  };

  const traceTypeColors: Record<string, string> = {
    'session-start': 'border-green-500/30 bg-green-500/5',
    'session-end': 'border-green-500/30 bg-green-500/5',
    'stage-start': 'border-blue-500/30 bg-blue-500/5',
    'stage-end': 'border-blue-500/30 bg-blue-500/5',
    'member-request': 'border-purple-500/30 bg-purple-500/5',
    'member-response': 'border-purple-500/30 bg-purple-500/5',
    'vote-cast': 'border-yellow-500/30 bg-yellow-500/5',
    'voting-complete': 'border-yellow-500/30 bg-yellow-500/5',
    'correction-triggered': 'border-orange-500/30 bg-orange-500/5',
    'backup-activated': 'border-orange-500/30 bg-orange-500/5',
    'error': 'border-red-500/30 bg-red-500/5',
  };

  // Calculate timeline
  const startTime = data.traces.length > 0 
    ? new Date(data.traces[0]!.timestamp).getTime() 
    : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to={`/session/${id}`}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Debug View</h1>
          <p className="text-sm text-gray-400">Session: {id}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Total Events</div>
          <div className="text-2xl font-bold text-white">{data.traces.length}</div>
        </div>
      </div>

      {/* Timeline Legend */}
      <div className="glass rounded-xl p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Event Types</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(traceTypeIcons).map(([type, icon]) => (
            <div key={type} className="flex items-center gap-2 text-sm">
              {icon}
              <span className="text-gray-300">{type.replace(/-/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {data.traces.map((trace) => {
          const relativeTime = new Date(trace.timestamp).getTime() - startTime;
          const isExpanded = expandedTraces.has(trace.id);

          return (
            <div
              key={trace.id}
              className={cn(
                'rounded-lg border p-4 transition-all',
                traceTypeColors[trace.type] ?? 'border-gray-700 bg-gray-800/50'
              )}
            >
              <div 
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => toggleExpanded(trace.id)}
              >
                {/* Timeline indicator */}
                <div className="flex flex-col items-center w-12 flex-shrink-0">
                  <span className="text-xs text-gray-500 font-mono">
                    +{(relativeTime / 1000).toFixed(2)}s
                  </span>
                </div>

                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {traceTypeIcons[trace.type] ?? <MessageSquare className="w-4 h-4 text-gray-400" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{trace.type}</span>
                    {trace.stage && (
                      <span className="px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300">
                        {trace.stage}
                      </span>
                    )}
                    {trace.memberName && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-xs text-purple-300">
                        {trace.memberName}
                      </span>
                    )}
                  </div>
                  {trace.durationMs !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{trace.durationMs}ms</span>
                    </div>
                  )}
                </div>

                {/* Expand button */}
                {trace.data && Object.keys(trace.data).length > 0 && (
                  <button className="p-1 hover:bg-gray-700 rounded">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                )}
              </div>

              {/* Expanded data */}
              {isExpanded && trace.data && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <pre className="text-xs text-gray-300 overflow-x-auto bg-gray-900/50 rounded-lg p-3">
                    {JSON.stringify(trace.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {data.traces.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No trace events found for this session.
        </div>
      )}
    </div>
  );
}
