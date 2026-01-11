import { cn } from '@/lib/utils';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MessageSquare,
  Vote,
  Sparkles,
  Brain,
  Users,
  RefreshCw
} from 'lucide-react';
import type { CouncilProgressState, MemberProgress, CouncilStage } from '@/hooks/useCouncilProgress';

interface CouncilProgressProps {
  progress: CouncilProgressState;
  className?: string;
}

const STAGE_CONFIG: Record<CouncilStage, { icon: React.ReactNode; label: string; color: string }> = {
  connecting: { icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Connecting', color: 'text-gray-400' },
  planning: { icon: <Brain className="w-4 h-4" />, label: 'Planning', color: 'text-purple-400' },
  opinions: { icon: <Users className="w-4 h-4" />, label: 'Gathering Opinions', color: 'text-blue-400' },
  review: { icon: <MessageSquare className="w-4 h-4" />, label: 'Peer Review', color: 'text-indigo-400' },
  voting: { icon: <Vote className="w-4 h-4" />, label: 'Voting', color: 'text-amber-400' },
  synthesis: { icon: <Sparkles className="w-4 h-4" />, label: 'Synthesizing', color: 'text-council-primary' },
  correction: { icon: <RefreshCw className="w-4 h-4" />, label: 'Self-Correction', color: 'text-orange-400' },
  complete: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Complete', color: 'text-green-400' },
};

function MemberCard({ member }: { member: MemberProgress }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-300',
        member.status === 'complete' && 'bg-green-500/10 border border-green-500/30',
        member.status === 'querying' && 'bg-blue-500/10 border border-blue-500/30 animate-pulse',
        member.status === 'waiting' && 'bg-gray-800/50 border border-gray-700',
        member.status === 'error' && 'bg-red-500/10 border border-red-500/30'
      )}
    >
      <span className="flex-shrink-0">
        {member.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
        {member.status === 'querying' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
        {member.status === 'waiting' && <Clock className="w-4 h-4 text-gray-500" />}
        {member.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
      </span>
      <div className="flex-1 min-w-0">
        <span className={cn(
          'block truncate font-medium',
          member.status === 'complete' && 'text-green-400',
          member.status === 'querying' && 'text-blue-400',
          member.status === 'waiting' && 'text-gray-500',
          member.status === 'error' && 'text-red-400'
        )}>
          {member.name}
        </span>
        <span className="block text-xs text-gray-500 truncate">{member.model}</span>
      </div>
      {member.durationMs && (
        <span className="text-xs text-gray-500 flex-shrink-0">
          {(member.durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function StageIndicator({ stage, isComplete }: { stage: CouncilStage; isComplete: boolean }) {
  const stages: CouncilStage[] = ['opinions', 'review', 'voting', 'synthesis'];
  const currentIndex = stages.indexOf(stage);
  
  return (
    <div className="flex items-center gap-1">
      {stages.map((s, index) => {
        const config = STAGE_CONFIG[s];
        const isActive = s === stage;
        const isPast = index < currentIndex || isComplete;
        
        return (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                isActive && 'bg-council-primary/20 ring-2 ring-council-primary',
                isPast && 'bg-green-500/20',
                !isActive && !isPast && 'bg-gray-800'
              )}
            >
              <span className={cn(
                isPast ? 'text-green-400' : isActive ? config.color : 'text-gray-600'
              )}>
                {isPast ? <CheckCircle2 className="w-4 h-4" /> : config.icon}
              </span>
            </div>
            {index < stages.length - 1 && (
              <div className={cn(
                'w-8 h-0.5 mx-1',
                isPast || (isActive && index < currentIndex) ? 'bg-green-500/50' : 'bg-gray-700'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CouncilProgress({ progress, className }: CouncilProgressProps) {
  const stageConfig = STAGE_CONFIG[progress.stage];
  
  return (
    <div className={cn('glass rounded-2xl p-6 space-y-6', className)}>
      {/* Header with Stage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            progress.stage === 'complete' ? 'bg-green-500/20' : 'bg-council-primary/20'
          )}>
            <span className={stageConfig.color}>{stageConfig.icon}</span>
          </div>
          <div>
            <h3 className={cn('font-semibold', stageConfig.color)}>
              {stageConfig.label}
            </h3>
            {progress.correctionRound && progress.stage === 'correction' && (
              <p className="text-xs text-gray-500">Round {progress.correctionRound}</p>
            )}
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="text-right">
          <span className="text-2xl font-bold text-white">
            {Math.round(progress.overallProgress)}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-gradient-to-r from-council-primary to-council-secondary transition-all duration-500 ease-out"
            style={{ width: `${progress.overallProgress}%` }}
          />
          {/* Animated shimmer */}
          {!progress.isComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          )}
        </div>
        
        {/* Stage Indicator */}
        <div className="flex justify-center pt-2">
          <StageIndicator stage={progress.stage} isComplete={progress.isComplete} />
        </div>
      </div>

      {/* Member Grid */}
      {progress.members.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">
            Council Members ({progress.members.filter(m => m.status === 'complete').length}/{progress.members.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {progress.members.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Config Info */}
      {progress.dynamicConfig && (
        <div className="flex flex-wrap gap-2">
          {progress.dynamicConfig.complexity && (
            <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">
              {progress.dynamicConfig.complexity} complexity
            </span>
          )}
          {progress.dynamicConfig.domain && (
            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
              {progress.dynamicConfig.domain}
            </span>
          )}
          {progress.dynamicConfig.planningMode && (
            <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full">
              {progress.dynamicConfig.planningMode} mode
            </span>
          )}
        </div>
      )}

      {/* Voting Results */}
      {progress.voting && progress.stage === 'voting' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <h4 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
            <Vote className="w-4 h-4" />
            Voting Results
          </h4>
          <div className="space-y-2">
            {progress.voting.winner && (
              <p className="text-white">
                <span className="text-gray-400">Winner:</span> {progress.voting.winner}
              </p>
            )}
            {progress.voting.confidenceAvg !== undefined && (
              <p className="text-white">
                <span className="text-gray-400">Confidence:</span>{' '}
                {(progress.voting.confidenceAvg * 100).toFixed(0)}%
              </p>
            )}
            {progress.voting.consensusReached !== undefined && (
              <p className={progress.voting.consensusReached ? 'text-green-400' : 'text-amber-400'}>
                {progress.voting.consensusReached ? '✓ Consensus reached' : '⚠ No consensus yet'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* LLM Narrative */}
      <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl">
        <span className="text-2xl flex-shrink-0">💬</span>
        <div className="flex-1">
          <p className="text-gray-300 italic animate-in fade-in duration-300">
            "{progress.narrative}"
          </p>
          {progress.narrativeHistory.length > 1 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
                Show previous updates ({progress.narrativeHistory.length - 1})
              </summary>
              <div className="mt-2 space-y-1">
                {progress.narrativeHistory.slice(0, -1).reverse().map((text, i) => (
                  <p key={i} className="text-xs text-gray-600 italic">"{text}"</p>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Error Display */}
      {progress.error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-red-400">Error</h4>
            <p className="text-sm text-gray-400">{progress.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CouncilProgress;
