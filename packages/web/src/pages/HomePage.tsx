import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
  Send, 
  Loader2, 
  Sparkles, 
  Users, 
  Brain, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Preset {
  key: string;
  name: string;
  description: string;
  memberCount: number;
}

export function HomePage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');

  // Fetch presets
  const { data: presets } = useQuery<Preset[]>({
    queryKey: ['presets'],
    queryFn: async () => {
      const res = await fetch('/api/council/presets');
      return res.json();
    },
  });

  // Fetch recent sessions
  const { data: sessionsData } = useQuery<{
    sessions: Array<{
      id: string;
      question: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      finalConfidence: number | null;
      totalDurationMs: number;
      createdAt: string;
    }>;
    total: number;
  }>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions?limit=5');
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5s to catch running sessions
  });

  // Run council mutation
  const runCouncil = useMutation({
    mutationFn: async ({ question, preset }: { question: string; preset: string }) => {
      const res = await fetch('/api/council/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, preset }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      navigate(`/session/${data.sessionId}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    runCouncil.mutate({ question, preset: selectedPreset });
  };

  const presetIcons: Record<string, React.ReactNode> = {
    small: <Zap className="w-5 h-5" />,
    standard: <Users className="w-5 h-5" />,
    reasoning: <Brain className="w-5 h-5" />,
    diverse: <Sparkles className="w-5 h-5" />,
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-4">
          Multi-Model Consensus
        </h2>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Ask a question and watch multiple AI models debate, review, vote, 
          and synthesize a final answer through democratic consensus.
        </p>
      </div>

      {/* Question Form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="glass rounded-2xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything... e.g., 'What are the ethical implications of AI in healthcare?'"
            className="w-full h-32 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-council-primary focus:border-transparent resize-none"
            disabled={runCouncil.isPending}
          />

          {/* Preset Selection */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Council Configuration
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {presets?.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setSelectedPreset(preset.key)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-left',
                    selectedPreset === preset.key
                      ? 'border-council-primary bg-council-primary/20'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {presetIcons[preset.key]}
                    <span className="font-medium text-white">{preset.name}</span>
                  </div>
                  <p className="text-xs text-gray-400">{preset.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {preset.memberCount} members
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={!question.trim() || runCouncil.isPending}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                question.trim() && !runCouncil.isPending
                  ? 'bg-gradient-to-r from-council-primary to-council-secondary text-white hover:shadow-lg hover:shadow-council-primary/25'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              {runCouncil.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Convening Council...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Ask the Council</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Error Display */}
      {runCouncil.isError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-400">Error</h4>
            <p className="text-sm text-gray-400">
              {runCouncil.error?.message ?? 'Failed to run council'}
            </p>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mt-12">
        <FeatureCard
          icon={<Users className="w-6 h-6" />}
          title="Multi-Model Debate"
          description="Multiple AI models share their perspectives and challenge each other's reasoning"
        />
        <FeatureCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          title="Democratic Voting"
          description="Models vote on the best answer using configurable voting methods"
        />
        <FeatureCard
          icon={<Brain className="w-6 h-6" />}
          title="Self-Correction"
          description="Backup models join automatically when confidence is low"
        />
      </div>

      {/* Recent Sessions */}
      {sessionsData && sessionsData.sessions.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Sessions</h2>
          <div className="space-y-3">
            {sessionsData.sessions.map((session) => (
              <Link
                key={session.id}
                to={`/session/${session.id}`}
                className="glass rounded-xl p-4 flex items-center justify-between hover:border-council-primary/50 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    session.status === 'completed' ? 'bg-green-400' :
                    session.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                    session.status === 'failed' ? 'bg-red-400' : 'bg-gray-400'
                  )} />
                  <p className="text-white truncate flex-1">{session.question}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {session.finalConfidence !== null && (
                    <span className={cn(
                      'text-sm font-medium',
                      session.finalConfidence >= 0.7 ? 'text-green-400' :
                      session.finalConfidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                    )}>
                      {(session.finalConfidence * 100).toFixed(0)}%
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{(session.totalDurationMs / 1000).toFixed(1)}s</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-council-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="glass rounded-xl p-6">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-council-primary/20 to-council-secondary/20 flex items-center justify-center text-council-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
