import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Send, 
  Sparkles, 
  Users, 
  Brain, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Settings,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InlineConfig } from '@/components/InlineConfig';
import { ConfidenceBadge, ConfidenceBar } from '@/components/ConfidenceBadge';
import { CouncilProgress } from '@/components/CouncilProgress';
import { useCouncilProgress } from '@/hooks/useCouncilProgress';

// Match API response from /api/council/presets
interface Preset {
  key: string;
  name: string;
  description: string;
  memberCount: number;
  config: {
    councilSize?: number;
    votingMethod?: string;
    selfCorrectionEnabled?: boolean;
    selfCorrectionThreshold?: number;
    maxCorrectionRounds?: number;
  };
}

interface SessionSummary {
  id: string;
  question: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  finalConfidence: number | null;
  previousConfidence?: number | null;
  totalDurationMs: number;
  createdAt: string;
  roundCount?: number;
  memberCount?: number;
  finalAnswerPreview?: string;
}

export function HomePage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');
  const [showConfig, setShowConfig] = useState(false);
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // WebSocket-based council progress
  const handleSessionComplete = useCallback((sessionId: string) => {
    setIsRunning(false);
    navigate(`/session/${sessionId}`);
  }, [navigate]);

  const councilProgress = useCouncilProgress(question, {
    enabled: isRunning,
    useDynamic: true,
    narrate: true,
    preset: selectedPreset,
    onComplete: handleSessionComplete,
  });

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
    sessions: SessionSummary[];
    total: number;
  }>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions?limit=5');
      return res.json();
    },
    refetchInterval: 5000,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isRunning) return;
    setIsRunning(true);
    councilProgress.start();
  };

  const handleCancel = () => {
    councilProgress.stop();
    setIsRunning(false);
  };

  const presetIcons: Record<string, React.ReactNode> = {
    small: <Zap className="w-5 h-5" />,
    standard: <Users className="w-5 h-5" />,
    reasoning: <Brain className="w-5 h-5" />,
    diverse: <Sparkles className="w-5 h-5" />,
  };

  const selectedPresetData = presets?.find(p => p.key === selectedPreset);

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

      {/* Question Form OR Council Progress */}
      {isRunning ? (
        <div className="mb-8 space-y-4">
          {/* Show the question being asked */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1">Your Question</p>
                <p className="text-white font-medium">{question}</p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
              >
                <Square className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
          
          {/* Progress Display */}
          <CouncilProgress progress={councilProgress} />
        </div>
      ) : (
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
              disabled={isRunning}
            />

          {/* Preset Selection with Hover Tooltips */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Council Preset
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {presets?.map((preset) => (
                <div key={preset.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedPreset(preset.key)}
                    onMouseEnter={() => setHoveredPreset(preset.key)}
                    onMouseLeave={() => setHoveredPreset(null)}
                    className={cn(
                      'w-full p-4 rounded-xl border-2 transition-all text-left',
                      selectedPreset === preset.key
                        ? 'border-council-primary bg-council-primary/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {presetIcons[preset.key]}
                      <span className="font-medium text-white">{preset.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      👥 {preset.memberCount} members
                    </p>
                  </button>

                  {/* Hover Tooltip */}
                  {hoveredPreset === preset.key && (
                    <div className="absolute z-20 top-full left-0 mt-2 w-72 glass rounded-xl p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <h4 className="font-semibold text-white mb-2">{preset.name}</h4>
                      <p className="text-sm text-gray-400 mb-3">{preset.description}</p>
                      
                      <div className="space-y-2 text-xs text-gray-400">
                        <p>👥 {preset.memberCount} members</p>
                        {preset.config?.votingMethod && (
                          <p>🗳️ Voting: {preset.config.votingMethod}</p>
                        )}
                        {preset.config?.selfCorrectionEnabled && (
                          <p>🔄 Self-correction enabled (threshold: {((preset.config.selfCorrectionThreshold ?? 0.65) * 100).toFixed(0)}%)</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Inline Config Toggle + Submit */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">
                {selectedPresetData?.name ?? 'Standard'} • {selectedPresetData?.memberCount ?? 5} members
              </span>
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all',
                  showConfig
                    ? 'bg-council-primary/20 text-council-primary'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                )}
              >
                <Settings className="w-4 h-4" />
                <span>{showConfig ? 'Hide' : 'Customize'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!question.trim() || isRunning}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                question.trim() && !isRunning
                  ? 'bg-gradient-to-r from-council-primary to-council-secondary text-white hover:shadow-lg hover:shadow-council-primary/25'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              <Send className="w-5 h-5" />
              <span>Ask the Council</span>
            </button>
          </div>

          {/* Inline Config Panel */}
          {showConfig && (
            <InlineConfig 
              preset={selectedPreset} 
              onConfigChange={(config) => console.log('Config changed:', config)}
              onClose={() => setShowConfig(false)}
            />
          )}
        </div>
        </form>
      )}

      {/* Error Display */}
      {councilProgress.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 mb-8">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-400">Error</h4>
            <p className="text-sm text-gray-400">
              {councilProgress.error}
            </p>
          </div>
        </div>
      )}

      {/* Recent Sessions (Enhanced) */}
      {sessionsData && sessionsData.sessions.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Sessions</h2>
          <div className="space-y-3">
            {sessionsData.sessions.map((session) => (
              <Link
                key={session.id}
                to={`/session/${session.id}`}
                className="glass rounded-xl p-4 block hover:border-council-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        session.status === 'completed' ? 'bg-green-400' :
                        session.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                        session.status === 'failed' ? 'bg-red-400' : 'bg-gray-400'
                      )} />
                      <p className="text-white font-medium truncate">{session.question}</p>
                    </div>
                    
                    {session.finalAnswerPreview && (
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {session.finalAnswerPreview}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Confidence with Trend */}
                    {session.finalConfidence !== null && (
                      <div className="text-right">
                        <ConfidenceBadge value={session.finalConfidence} size="sm" />
                        {session.previousConfidence !== null && session.previousConfidence !== undefined && (
                          <p className="text-xs text-green-400 mt-0.5">
                            ↑ from {(session.previousConfidence * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-col items-end gap-1 text-xs text-gray-500">
                      {session.roundCount && (
                        <span>🔄 {session.roundCount} rounds</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{(session.totalDurationMs / 1000).toFixed(1)}s</span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-council-primary transition-colors" />
                  </div>
                </div>

                {/* Confidence Bar */}
                {session.finalConfidence !== null && (
                  <div className="mt-3">
                    <ConfidenceBar value={session.finalConfidence} showLabel={false} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6">
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
          description="Iterative refinement when confidence is below threshold"
        />
      </div>
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
