import { useState, useEffect } from 'react';
import { 
  Settings, 
  X, 
  Plus, 
  Trash2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface InlineConfigProps {
  preset: string;
  onConfigChange?: (config: CouncilConfig) => void;
  onClose?: () => void;  // Parent controls close
}

interface CouncilConfig {
  members: MemberConfig[];
  votingMethod: string;
  enableIterations: boolean;
  maxIterations: number;
  iterationStrategy: string;
  confidenceThreshold: number;
}

interface MemberConfig {
  name: string;
  role: string;
  modelId: string;
}

// Match API response shape: /api/council/roles returns {role, description, stage}
interface Role {
  role: string;
  description: string;
  stage: string;
}

// Match API response shape: /api/council/voting-methods returns {method, description, threshold}
interface VotingMethod {
  method: string;
  description: string;
  threshold: number;
}

// InlineConfig is always visible when rendered - parent controls show/hide
export function InlineConfig({ preset, onConfigChange, onClose }: InlineConfigProps) {
  const [config, setConfig] = useState<CouncilConfig>({
    members: [],
    votingMethod: 'confidence',
    enableIterations: false,
    maxIterations: 3,
    iterationStrategy: 'refine',
    confidenceThreshold: 0.85,
  });

  // Fetch available roles
  const { data: roles } = useQuery<Role[]>({
    queryKey: ['council', 'roles'],
    queryFn: async () => {
      const res = await fetch('/api/council/roles');
      return res.json();
    },
  });

  // Fetch voting methods
  const { data: votingMethods } = useQuery<VotingMethod[]>({
    queryKey: ['council', 'voting-methods'],
    queryFn: async () => {
      const res = await fetch('/api/council/voting-methods');
      return res.json();
    },
  });

  // Fetch preset details
  const { data: presetDetails } = useQuery<{
    key: string;
    name: string;
    description: string;
    memberCount: number;
    config: {
      votingMethod?: string;
      selfCorrectionEnabled?: boolean;
    };
    members: MemberConfig[];
  }>({
    queryKey: ['preset', preset],
    queryFn: async () => {
      const res = await fetch(`/api/council/presets/${preset}`);
      if (!res.ok) throw new Error('Failed to fetch preset');
      return res.json();
    },
  });

  // Initialize config from preset when preset details load
  useEffect(() => {
    if (presetDetails) {
      setConfig(prev => ({
        ...prev,
        members: presetDetails.members || [],
        votingMethod: presetDetails.config?.votingMethod || 'confidence',
      }));
    }
  }, [presetDetails]);

  const updateConfig = (updates: Partial<CouncilConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const addMember = () => {
    const newMember: MemberConfig = {
      name: `Member ${config.members.length + 1}`,
      role: 'opinion-giver',
      modelId: 'gpt-5',
    };
    updateConfig({ members: [...config.members, newMember] });
  };

  const removeMember = (index: number) => {
    updateConfig({ members: config.members.filter((_, i) => i !== index) });
  };

  const updateMember = (index: number, updates: Partial<MemberConfig>) => {
    const newMembers = [...config.members];
    newMembers[index] = { ...newMembers[index]!, ...updates };
    updateConfig({ members: newMembers });
  };

  return (
    <div className="glass rounded-xl p-6 mt-4 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-council-primary" />
          <h3 className="font-semibold text-white">Advanced Configuration</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Members Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            👥 Members
          </h4>
          <div className="space-y-2">
            {config.members.map((member, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-2">
                <select
                  value={member.role}
                  onChange={(e) => updateMember(idx, { role: e.target.value })}
                  className="flex-1 bg-gray-700 border-none rounded px-2 py-1 text-sm text-white"
                >
                  {roles?.map(r => (
                    <option key={r.role} value={r.role}>{r.role}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeMember(idx)}
                  className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addMember}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Member</span>
            </button>
          </div>
        </div>

        {/* Voting Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            🗳️ Voting
          </h4>
          <div className="space-y-3">
            {votingMethods?.map(vm => (
              <label
                key={vm.method}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all',
                  config.votingMethod === vm.method
                    ? 'bg-council-primary/20 border border-council-primary/50'
                    : 'bg-gray-800/50 border border-transparent hover:border-gray-600'
                )}
              >
                <input
                  type="radio"
                  name="votingMethod"
                  value={vm.method}
                  checked={config.votingMethod === vm.method}
                  onChange={() => updateConfig({ votingMethod: vm.method })}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-white">{vm.method}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{vm.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Iterations Section */}
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            🔄 Iterations
          </h4>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enableIterations}
                onChange={(e) => updateConfig({ enableIterations: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-council-primary focus:ring-council-primary"
              />
              <span className="text-sm text-white">Enable Iterations</span>
            </label>

            {config.enableIterations && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Iterations</label>
                  <select
                    value={config.maxIterations}
                    onChange={(e) => updateConfig({ maxIterations: parseInt(e.target.value) })}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    {[2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} rounds</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Strategy</label>
                  <select
                    value={config.iterationStrategy}
                    onChange={(e) => updateConfig({ iterationStrategy: e.target.value })}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="refine">Refine (build on consensus)</option>
                    <option value="debate">Debate (address disagreements)</option>
                    <option value="synthesize">Synthesize (merge positions)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Confidence Threshold: {(config.confidenceThreshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={config.confidenceThreshold}
                    onChange={(e) => updateConfig({ confidenceThreshold: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
