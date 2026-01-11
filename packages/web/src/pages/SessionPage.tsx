import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Clock, 
  XCircle,
  Download,
  MessageSquare,
  Bug,
  Users,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DebateCard } from '@/components/DebateCard';
import { RoundHeader } from '@/components/RoundHeader';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { TimelineEvent } from '@/components/TimelineEvent';

interface Session {
  id: string;
  question: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  finalAnswer: string | null;
  finalConfidence: number | null;
  totalTokens: number;
  totalDurationMs: number;
  correctionRounds: number;
  stages: Stage[];
  members: Member[];
  createdAt: string;
}

interface Stage {
  stage: string;
  responses: Response[];
  votingResult?: VotingResult;
  durationMs: number;
  iteration?: number;
}

interface Response {
  memberId: string;
  memberName: string;
  modelId: string;
  role?: string;
  content: string;
  confidence?: number;
  latencyMs: number;
  tokenUsage?: { totalTokens: number };
}

interface VotingResult {
  winner: string | null;
  method: string;
  confidenceAvg: number;
  consensusReached: boolean;
  breakdown: Record<string, number>;
}

interface Member {
  id: string;
  name: string;
  role: string;
  modelConfig: { name: string };
}

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
}

type TabType = 'debate' | 'debug';

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('debate');
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([1])); // Latest round expanded by default
  const [debugFilters, setDebugFilters] = useState({
    requests: true,
    responses: true,
    voting: true,
    stages: true,
  });

  // Fetch session data
  const { data: session, isLoading, error } = useQuery<Session>({
    queryKey: ['session', id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error('Session not found');
      return res.json();
    },
    refetchInterval: (query) => 
      query.state.data?.status === 'running' ? 1000 : false,
  });

  // Fetch traces for debug tab
  const { data: tracesData } = useQuery<{ sessionId: string; traces: TraceEvent[] }>({
    queryKey: ['traces', id],
    queryFn: async () => {
      const res = await fetch(`/api/council/${id}/traces`);
      if (!res.ok) throw new Error('Traces not found');
      return res.json();
    },
    enabled: activeTab === 'debug',
  });

  // Group stages by iteration/round
  const rounds = useMemo(() => {
    if (!session?.stages) return [];
    
    // Group stages into rounds (a round = opinions + voting)
    const roundMap = new Map<number, {
      roundNumber: number;
      stages: Stage[];
      confidence: number;
      duration: number;
    }>();

    let currentRound = 1;
    let currentConfidence = 0;
    let roundStages: Stage[] = [];
    let roundDuration = 0;

    session.stages.forEach((stage) => {
      roundStages.push(stage);
      roundDuration += stage.durationMs;
      
      if (stage.votingResult) {
        currentConfidence = stage.votingResult.confidenceAvg;
      }

      // End of round: after voting or synthesis
      if (stage.stage === 'voting' || stage.stage === 'synthesis') {
        roundMap.set(currentRound, {
          roundNumber: currentRound,
          stages: [...roundStages],
          confidence: currentConfidence,
          duration: roundDuration,
        });
        currentRound++;
        roundStages = [];
        roundDuration = 0;
      }
    });

    // Handle any remaining stages
    if (roundStages.length > 0) {
      roundMap.set(currentRound, {
        roundNumber: currentRound,
        stages: roundStages,
        confidence: currentConfidence,
        duration: roundDuration,
      });
    }

    return Array.from(roundMap.values()).reverse(); // Most recent first
  }, [session?.stages]);

  // Group traces by round for debug view
  const tracesByRound = useMemo(() => {
    if (!tracesData?.traces) return new Map<number, TraceEvent[]>();
    
    const grouped = new Map<number, TraceEvent[]>();
    let currentRound = 1;
    
    tracesData.traces.forEach(trace => {
      // New round starts when a correction is triggered
      if (trace.type === 'correction-triggered') {
        currentRound++;
      }
      
      const existing = grouped.get(currentRound) ?? [];
      existing.push(trace);
      grouped.set(currentRound, existing);
    });

    return grouped;
  }, [tracesData?.traces]);

  // Filter traces
  const filteredTraces = useMemo(() => {
    if (!tracesData?.traces) return [];
    
    return tracesData.traces.filter(trace => {
      if (!debugFilters.requests && trace.type === 'member-request') return false;
      if (!debugFilters.responses && trace.type === 'member-response') return false;
      if (!debugFilters.voting && (trace.type === 'vote-cast' || trace.type === 'voting-complete')) return false;
      if (!debugFilters.stages && (trace.type === 'stage-start' || trace.type === 'stage-end')) return false;
      return true;
    });
  }, [tracesData?.traces, debugFilters]);

  const toggleRound = (roundNumber: number) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundNumber)) {
      newExpanded.delete(roundNumber);
    } else {
      newExpanded.add(roundNumber);
    }
    setExpandedRounds(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-council-primary"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Session Not Found</h2>
        <p className="text-gray-400 mb-4">The session you're looking for doesn't exist.</p>
        <Link to="/" className="text-council-primary hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const startTime = tracesData?.traces?.[0]?.timestamp 
    ? new Date(tracesData.traces[0].timestamp).getTime() 
    : 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/" 
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Council Session</h1>
        </div>
        <a
          href={`/api/sessions/${id}/export?format=markdown`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </a>
      </div>

      {/* Question */}
      <div className="glass rounded-xl p-5 mb-6">
        <p className="text-lg text-white">📝 {session.question}</p>
      </div>

      {/* Tab Navigation + Stats */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('debate')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium',
              activeTab === 'debate'
                ? 'bg-council-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Debate
          </button>
          <button
            onClick={() => setActiveTab('debug')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium',
              activeTab === 'debug'
                ? 'bg-council-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            )}
          >
            <Bug className="w-4 h-4" />
            Debug
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6">
          {session.finalConfidence !== null && (
            <ConfidenceBadge value={session.finalConfidence} size="lg" />
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{(session.totalDurationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>🔄 {rounds.length} round{rounds.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* === DEBATE TAB === */}
      {activeTab === 'debate' && (
        <div className="space-y-6">
          {/* Final Answer */}
          {session.finalAnswer && (
            <div className="bg-gradient-to-r from-council-primary/10 to-council-secondary/10 border border-council-primary/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-council-primary" />
                <h2 className="font-semibold text-white">Final Answer</h2>
                {session.finalConfidence !== null && (
                  <ConfidenceBadge value={session.finalConfidence} size="sm" />
                )}
              </div>
              <div className="text-gray-200 whitespace-pre-wrap">
                {session.finalAnswer}
              </div>
            </div>
          )}

          {/* Rounds */}
          {rounds.map((round, idx) => {
            const isLatest = idx === 0;
            const isExpanded = expandedRounds.has(round.roundNumber) || isLatest;
            const previousRound = rounds[idx + 1];
            
            return (
              <div key={round.roundNumber} className="space-y-4">
                <RoundHeader
                  roundNumber={round.roundNumber}
                  label={isLatest ? 'Final' : undefined}
                  confidence={round.confidence}
                  previousConfidence={previousRound?.confidence}
                  isExpanded={isExpanded}
                  onToggle={() => !isLatest && toggleRound(round.roundNumber)}
                  isLatest={isLatest}
                  duration={round.duration}
                />

                {isExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {round.stages.map((stage, stageIdx) => (
                      <div key={stageIdx}>
                        {/* Stage Responses */}
                        {stage.responses.map((response, rIdx) => {
                          const member = session.members.find(m => m.id === response.memberId);
                          return (
                            <div key={rIdx} className="mb-4">
                              <DebateCard
                                memberId={response.memberId}
                                memberName={response.memberName}
                                role={member?.role ?? 'member'}
                                content={response.content}
                                confidence={response.confidence}
                                latencyMs={response.latencyMs}
                                tokenCount={response.tokenUsage?.totalTokens}
                              />
                            </div>
                          );
                        })}

                        {/* Voting Result */}
                        {stage.votingResult && (
                          <div className="glass rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 text-sm">🗳️ Voting</span>
                              <span className="px-2 py-1 rounded bg-gray-700 text-xs text-gray-300">
                                {stage.votingResult.method}
                              </span>
                              <span className={cn(
                                'px-2 py-1 rounded text-xs',
                                stage.votingResult.consensusReached 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-yellow-500/20 text-yellow-400'
                              )}>
                                {stage.votingResult.consensusReached ? '✅ Consensus' : '⚠️ No Consensus'}
                              </span>
                            </div>
                            <ConfidenceBadge value={stage.votingResult.confidenceAvg} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Council Members Footer */}
          <div className="glass rounded-xl p-4 mt-8">
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
              <Users className="w-4 h-4" />
              <span>Council Members</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.members.map((member) => (
                <span 
                  key={member.id}
                  className="px-3 py-1 rounded-full bg-gray-800 text-sm text-gray-300"
                >
                  {member.name} <span className="text-gray-500">({member.role})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === DEBUG TAB === */}
      {activeTab === 'debug' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass rounded-xl p-4 flex items-center gap-6">
            <span className="text-sm text-gray-400">Filter:</span>
            {[
              { key: 'requests', label: 'Requests' },
              { key: 'responses', label: 'Responses' },
              { key: 'voting', label: 'Voting' },
              { key: 'stages', label: 'Stages' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={debugFilters[key as keyof typeof debugFilters]}
                  onChange={(e) => setDebugFilters(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-council-primary"
                />
                <span className="text-sm text-gray-300">{label}</span>
              </label>
            ))}
          </div>

          {/* Timeline by Round */}
          {Array.from(tracesByRound.entries()).map(([roundNumber, traces]) => {
            const roundTraces = traces.filter(t => filteredTraces.includes(t));
            if (roundTraces.length === 0) return null;

            return (
              <div key={roundNumber}>
                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-gray-700" />
                  <span className="text-sm font-medium text-gray-400">
                    ROUND {roundNumber}
                  </span>
                  <div className="h-px flex-1 bg-gray-700" />
                </div>
                
                <div className="space-y-2">
                  {roundTraces.map((trace) => (
                    <TimelineEvent
                      key={trace.id}
                      type={trace.type}
                      stage={trace.stage}
                      memberName={trace.memberName}
                      timestamp={trace.timestamp}
                      relativeTime={new Date(trace.timestamp).getTime() - startTime}
                      durationMs={trace.durationMs}
                      data={trace.data}
                      content={(trace.data as any)?.content}
                      confidence={(trace.data as any)?.confidence}
                      tokenCount={(trace.data as any)?.tokenUsage?.totalTokens}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {(!tracesData?.traces || filteredTraces.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              No trace events found. Try adjusting your filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
