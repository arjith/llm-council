import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Progress states for council members
 */
export type MemberStatus = 'waiting' | 'querying' | 'complete' | 'error';

/**
 * Pipeline stages
 */
export type CouncilStage = 'connecting' | 'planning' | 'opinions' | 'review' | 'voting' | 'synthesis' | 'correction' | 'complete';

/**
 * Individual member progress
 */
export interface MemberProgress {
  id: string;
  name: string;
  model: string;
  role: string;
  status: MemberStatus;
  durationMs?: number;
  responsePreview?: string;
}

/**
 * Dynamic config from meta-council
 */
export interface DynamicConfig {
  complexity?: string;
  domain?: string;
  planningMode?: string;
  reasoning?: string;
  councilSize?: number;
}

/**
 * Voting result data
 */
export interface VotingProgress {
  winner?: string | null;
  confidenceAvg?: number;
  consensusReached?: boolean;
  breakdown?: Record<string, number>;
}

/**
 * Full progress state
 */
export interface CouncilProgressState {
  isConnected: boolean;
  stage: CouncilStage;
  stageProgress: number; // 0-100 within current stage
  overallProgress: number; // 0-100 overall
  members: MemberProgress[];
  narrative: string;
  narrativeHistory: string[];
  voting?: VotingProgress;
  dynamicConfig?: DynamicConfig;
  correctionRound?: number;
  isComplete: boolean;
  error?: string;
  sessionId?: string;
}

/**
 * WebSocket message types
 */
interface WSMessage {
  type: string;
  stage?: string;
  memberName?: string;
  memberModel?: string;
  memberId?: string;
  model?: string;
  latencyMs?: number;
  text?: string;
  message?: string;
  timestamp?: string;
  winner?: string | null;
  confidence?: number;
  confidenceAvg?: number;
  consensusReached?: boolean;
  breakdown?: Record<string, number>;
  round?: number;
  reason?: string;
  sessionId?: string;
  status?: string;
  config?: DynamicConfig;
  finalAnswer?: string;
  finalConfidence?: number;
  analysis?: DynamicConfig & { members?: Array<{ model: string; role: string }> };
  session?: {
    id?: string;
    finalAnswer?: string;
    finalConfidence?: number;
    totalDurationMs?: number;
    dynamicConfig?: DynamicConfig;
  };
}

const STAGE_WEIGHTS: Record<CouncilStage, number> = {
  connecting: 0,
  planning: 5,
  opinions: 40,
  review: 60,
  voting: 80,
  synthesis: 95,
  correction: 90,
  complete: 100,
};

const DEFAULT_NARRATIVES: Record<CouncilStage, string> = {
  connecting: 'Connecting to the council chamber...',
  planning: 'The council is analyzing your question...',
  opinions: 'Council members are forming their initial opinions...',
  review: 'Members are reviewing and critiquing each other\'s perspectives...',
  voting: 'The council is casting their votes...',
  synthesis: 'Synthesizing the final consensus answer...',
  correction: 'The council is refining their answer...',
  complete: 'The council has reached a decision!',
};

/**
 * Custom hook for real-time council progress via WebSocket
 */
export function useCouncilProgress(question: string, options?: {
  enabled?: boolean;
  useDynamic?: boolean;
  narrate?: boolean;
  preset?: string;
  onComplete?: (sessionId: string) => void;
}) {
  const { 
    enabled = true, 
    useDynamic = true, 
    narrate = true,
    preset,
    onComplete 
  } = options ?? {};

  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<CouncilProgressState>({
    isConnected: false,
    stage: 'connecting',
    stageProgress: 0,
    overallProgress: 0,
    members: [],
    narrative: DEFAULT_NARRATIVES.connecting,
    narrativeHistory: [],
    isComplete: false,
  });

  // Calculate overall progress based on stage and members
  const calculateProgress = useCallback((stage: CouncilStage, members: MemberProgress[]): number => {
    const baseProgress = STAGE_WEIGHTS[stage] ?? 0;
    
    if (stage === 'opinions' || stage === 'review') {
      const completedMembers = members.filter(m => m.status === 'complete').length;
      const totalMembers = members.length || 1;
      const stageRange = stage === 'opinions' ? 35 : 20; // opinions: 5-40, review: 40-60
      const memberProgress = (completedMembers / totalMembers) * stageRange;
      return Math.min(baseProgress, STAGE_WEIGHTS.planning + memberProgress);
    }
    
    return baseProgress;
  }, []);

  // Start WebSocket connection and run council
  const start = useCallback(() => {
    // Don't check 'enabled' here - it may be stale due to closure.
    // The caller (handleSubmit) is responsible for ensuring we should start.
    if (!question.trim() || wsRef.current) return;

    const params = new URLSearchParams();
    params.set('question', question);
    if (useDynamic) params.set('dynamic', 'true');
    if (narrate) params.set('narrate', 'true');
    if (preset) params.set('preset', preset);
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/run?${params}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({
        ...prev,
        isConnected: true,
        stage: 'planning',
        narrative: DEFAULT_NARRATIVES.planning,
      }));
      // Question is sent via query params, no message needed
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        
        setState(prev => {
          const newState = { ...prev };

          switch (msg.type) {
            case 'plan:ready':
              newState.stage = 'opinions';
              // API sends analysis object with complexity, domain, etc.
              const analysis = msg.analysis;
              const config = msg.config;
              newState.dynamicConfig = {
                complexity: analysis?.complexity ?? config?.complexity,
                domain: analysis?.domain ?? config?.domain,
                reasoning: analysis?.reasoning ?? config?.reasoning,
                councilSize: analysis?.councilSize ?? config?.councilSize,
              };
              newState.narrative = `Council configured: ${analysis?.complexity ?? config?.complexity ?? 'standard'} complexity`;
              // Pre-populate members from analysis if available
              if (analysis?.members) {
                newState.members = analysis.members.map((m, i) => ({
                  id: `member-${i}`,
                  name: m.model,
                  model: m.model,
                  role: m.role,
                  status: 'waiting' as MemberStatus,
                }));
              }
              break;

            case 'session:start':
              newState.stage = 'opinions';
              newState.narrative = DEFAULT_NARRATIVES.opinions;
              break;

            case 'stage:start':
              newState.stage = (msg.stage as CouncilStage) ?? prev.stage;
              newState.narrative = DEFAULT_NARRATIVES[newState.stage] ?? prev.narrative;
              break;

            case 'stage:complete':
            case 'stage:end':
              // Move to next stage (API sends stage:end)
              break;

            case 'member:start':
            case 'member:request':
              // API sends member:request when starting
              const memberName = msg.memberName ?? msg.memberId;
              const existingMember = newState.members.find(m => m.name === memberName || m.id === msg.memberId);
              if (!existingMember && memberName) {
                newState.members = [...newState.members, {
                  id: msg.memberId ?? memberName,
                  name: memberName,
                  model: msg.memberModel ?? msg.model ?? 'unknown',
                  role: 'opinion-giver',
                  status: 'querying',
                }];
              } else if (existingMember) {
                newState.members = newState.members.map(m => 
                  (m.name === memberName || m.id === msg.memberId) ? { ...m, status: 'querying' as MemberStatus } : m
                );
              }
              break;

            case 'member:complete':
            case 'member:response':
              // API sends member:response when complete
              const respMemberName = msg.memberName ?? msg.memberId;
              newState.members = newState.members.map(m =>
                (m.name === respMemberName || m.id === msg.memberId)
                  ? { ...m, status: 'complete' as MemberStatus, durationMs: msg.latencyMs }
                  : m
              );
              break;

            case 'vote:result':
            case 'voting:complete':
              // API sends voting:complete
              newState.stage = 'voting';
              newState.voting = {
                winner: msg.winner,
                confidenceAvg: msg.confidenceAvg,
                consensusReached: msg.consensusReached,
                breakdown: msg.breakdown,
              };
              break;

            case 'synthesis:start':
              newState.stage = 'synthesis';
              newState.narrative = DEFAULT_NARRATIVES.synthesis;
              break;

            case 'correction:triggered':
              newState.stage = 'correction';
              newState.correctionRound = msg.round;
              newState.narrative = `Round ${msg.round}: ${msg.reason ?? 'Refining answer...'}`;
              // Reset member status for new round
              newState.members = newState.members.map(m => ({ ...m, status: 'waiting' as MemberStatus }));
              break;

            case 'session:complete':
            case 'complete':
            case 'session:end':
              // API sends 'complete' or 'session:end'
              newState.stage = 'complete';
              newState.isComplete = true;
              newState.sessionId = msg.sessionId ?? (msg as { session?: { id?: string } }).session?.id;
              newState.overallProgress = 100;
              newState.narrative = DEFAULT_NARRATIVES.complete;
              break;

            case 'narration':
              if (msg.text) {
                newState.narrative = msg.text;
                newState.narrativeHistory = [...prev.narrativeHistory.slice(-9), msg.text];
              }
              break;

            case 'error':
              newState.error = msg.text ?? msg.message ?? 'An error occurred';
              break;
          }

          // Recalculate progress
          newState.overallProgress = calculateProgress(newState.stage, newState.members);
          newState.stageProgress = newState.members.length > 0
            ? (newState.members.filter(m => m.status === 'complete').length / newState.members.length) * 100
            : 0;

          return newState;
        });
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      setState(prev => ({
        ...prev,
        error: 'WebSocket connection error',
        isConnected: false,
      }));
    };

    ws.onclose = () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
      }));
      wsRef.current = null;
    };
  }, [question, useDynamic, narrate, preset, calculateProgress]);

  // Stop and cleanup WebSocket
  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({
      isConnected: false,
      stage: 'connecting',
      stageProgress: 0,
      overallProgress: 0,
      members: [],
      narrative: DEFAULT_NARRATIVES.connecting,
      narrativeHistory: [],
      isComplete: false,
    });
  }, []);

  // Trigger onComplete callback
  useEffect(() => {
    if (state.isComplete && state.sessionId && onComplete) {
      onComplete(state.sessionId);
    }
  }, [state.isComplete, state.sessionId, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    start,
    stop,
  };
}

export default useCouncilProgress;
