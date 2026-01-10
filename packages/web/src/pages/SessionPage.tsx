import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Clock, 
  Coins, 
  CheckCircle2, 
  XCircle,
  Download,
  Bug,
  Users,
  MessageSquare,
  Vote,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface Response {
  memberId: string;
  memberName: string;
  modelId: string;
  content: string;
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

export function SessionPage() {
  const { id } = useParams<{ id: string }>();

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

  const stageIcons: Record<string, React.ReactNode> = {
    opinions: <MessageSquare className="w-4 h-4" />,
    review: <Users className="w-4 h-4" />,
    voting: <Vote className="w-4 h-4" />,
    synthesis: <Sparkles className="w-4 h-4" />,
  };

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
          <p className="text-sm text-gray-400">ID: {session.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/debug/${id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <Bug className="w-4 h-4" />
            <span>Debug View</span>
          </Link>
          <a
            href={`/api/sessions/${id}/export?format=markdown`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </a>
        </div>
      </div>

      {/* Status Bar */}
      <div className="glass rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <StatusBadge status={session.status} />
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{(session.totalDurationMs / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Coins className="w-4 h-4" />
            <span>{session.totalTokens.toLocaleString()} tokens</span>
          </div>
          {session.correctionRounds > 0 && (
            <div className="flex items-center gap-2 text-yellow-400">
              <span>🔄 {session.correctionRounds} correction round(s)</span>
            </div>
          )}
        </div>
        {session.finalConfidence !== null && (
          <div className="text-right">
            <div className="text-sm text-gray-400">Confidence</div>
            <div className={cn(
              'text-2xl font-bold',
              session.finalConfidence >= 0.7 ? 'text-green-400' :
              session.finalConfidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {(session.finalConfidence * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-2">Question</h2>
        <p className="text-lg text-white">{session.question}</p>
      </div>

      {/* Final Answer */}
      {session.finalAnswer && (
        <div className="bg-gradient-to-r from-council-primary/10 to-council-secondary/10 border border-council-primary/30 rounded-xl p-6 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-council-primary mb-3">
            <CheckCircle2 className="w-4 h-4" />
            Final Answer
          </h2>
          <div className="text-white whitespace-pre-wrap">{session.finalAnswer}</div>
        </div>
      )}

      {/* Stages */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Council Stages</h2>
        
        {session.stages.map((stage, idx) => (
          <div key={idx} className="glass rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-council-primary/20 flex items-center justify-center text-council-primary">
                  {stageIcons[stage.stage] ?? <MessageSquare className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-medium text-white capitalize">{stage.stage}</h3>
                  <p className="text-xs text-gray-400">
                    {stage.responses.length} responses • {stage.durationMs}ms
                  </p>
                </div>
              </div>
              {stage.votingResult && (
                <VotingBadge result={stage.votingResult} />
              )}
            </div>
            
            <div className="p-4 space-y-4">
              {stage.responses.map((response, rIdx) => (
                <div key={rIdx} className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{response.memberName}</span>
                    <span className="text-xs text-gray-500">
                      {response.latencyMs}ms • {response.tokenUsage?.totalTokens ?? '?'} tokens
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">
                    {response.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Members */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Council Members</h2>
        <div className="flex flex-wrap gap-3">
          {session.members.map((member) => (
            <div 
              key={member.id}
              className="glass rounded-lg px-4 py-2 flex items-center gap-2"
            >
              <div className={cn(
                'w-2 h-2 rounded-full',
                member.role === 'opinion-giver' ? 'bg-blue-400' :
                member.role === 'reviewer' ? 'bg-purple-400' :
                member.role === 'synthesizer' ? 'bg-green-400' :
                'bg-gray-400'
              )} />
              <span className="text-white">{member.name}</span>
              <span className="text-xs text-gray-400">({member.modelConfig.name})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-gray-500', label: 'Pending' },
    running: { color: 'bg-yellow-500 animate-pulse', label: 'Running' },
    completed: { color: 'bg-green-500', label: 'Completed' },
    failed: { color: 'bg-red-500', label: 'Failed' },
  }[status] ?? { color: 'bg-gray-500', label: status };

  return (
    <span className="flex items-center gap-2">
      <span className={cn('w-2 h-2 rounded-full', config.color)} />
      <span className="text-sm text-gray-300">{config.label}</span>
    </span>
  );
}

function VotingBadge({ result }: { result: VotingResult }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-xs text-gray-400">{result.method}</div>
        <div className={cn(
          'text-sm font-medium',
          result.consensusReached ? 'text-green-400' : 'text-yellow-400'
        )}>
          {result.consensusReached ? 'Consensus' : 'No Consensus'}
        </div>
      </div>
      <div className={cn(
        'px-3 py-1 rounded-full text-sm font-medium',
        result.confidenceAvg >= 0.7 ? 'bg-green-500/20 text-green-400' :
        result.confidenceAvg >= 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      )}>
        {(result.confidenceAvg * 100).toFixed(0)}%
      </div>
    </div>
  );
}
