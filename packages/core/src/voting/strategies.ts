import type { Vote, VotingResult, VotingMethod } from '../types.js';

/**
 * Base voting strategy interface
 */
export interface VotingStrategy {
  readonly method: VotingMethod;
  
  /**
   * Determine the winner from a set of votes
   */
  tally(votes: Vote[]): VotingResult;
}

/**
 * Simple majority voting - winner needs > 50% of votes
 */
export class MajorityVoting implements VotingStrategy {
  readonly method = 'majority' as const;

  tally(votes: Vote[]): VotingResult {
    const breakdown = this.countVotes(votes);
    const totalVotes = votes.length;
    const threshold = totalVotes / 2;

    let winner: string | null = null;
    let maxCount = 0;

    for (const [position, count] of Object.entries(breakdown)) {
      if (count > threshold && count > maxCount) {
        winner = position;
        maxCount = count;
      }
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown,
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded: 1,
    };
  }

  private countVotes(votes: Vote[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const vote of votes) {
      counts[vote.position] = (counts[vote.position] ?? 0) + 1;
    }
    return counts;
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Super-majority voting - winner needs >= threshold (default 2/3)
 */
export class SuperMajorityVoting implements VotingStrategy {
  readonly method = 'super-majority' as const;
  private threshold: number;

  constructor(threshold = 2/3) {
    this.threshold = threshold;
  }

  tally(votes: Vote[]): VotingResult {
    const breakdown = this.countVotes(votes);
    const totalVotes = votes.length;
    const requiredVotes = totalVotes * this.threshold;

    let winner: string | null = null;
    let maxCount = 0;

    for (const [position, count] of Object.entries(breakdown)) {
      if (count >= requiredVotes && count > maxCount) {
        winner = position;
        maxCount = count;
      }
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown,
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded: 1,
      metadata: { threshold: this.threshold },
    };
  }

  private countVotes(votes: Vote[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const vote of votes) {
      counts[vote.position] = (counts[vote.position] ?? 0) + 1;
    }
    return counts;
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Weighted voting - votes are weighted by member weight and confidence
 */
export class WeightedVoting implements VotingStrategy {
  readonly method = 'weighted' as const;
  private weights: Map<string, number>;

  constructor(memberWeights: Map<string, number>) {
    this.weights = memberWeights;
  }

  tally(votes: Vote[]): VotingResult {
    const breakdown: Record<string, number> = {};

    for (const vote of votes) {
      const weight = this.weights.get(vote.memberId) ?? 1;
      const weightedVote = weight * vote.confidence;
      breakdown[vote.position] = (breakdown[vote.position] ?? 0) + weightedVote;
    }

    let winner: string | null = null;
    let maxWeight = 0;

    for (const [position, weight] of Object.entries(breakdown)) {
      if (weight > maxWeight) {
        winner = position;
        maxWeight = weight;
      }
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown,
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded: 1,
    };
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Ranked-choice voting (Instant Runoff)
 */
export class RankedChoiceVoting implements VotingStrategy {
  readonly method = 'ranked-choice' as const;

  tally(votes: Vote[]): VotingResult {
    if (votes.length === 0 || !votes[0]?.rank) {
      return {
        method: this.method,
        winner: null,
        votes,
        breakdown: {},
        confidenceAvg: 0,
        consensusReached: false,
        roundsNeeded: 0,
      };
    }

    // Clone rankings for manipulation
    const rankings = votes.map(v => [...(v.rank ?? [])]);
    let roundsNeeded = 0;
    let winner: string | null = null;

    while (!winner) {
      roundsNeeded++;
      
      // Count first-choice votes
      const firstChoiceCounts: Record<string, number> = {};
      for (const ranking of rankings) {
        if (ranking.length > 0) {
          const firstChoice = ranking[0]!;
          firstChoiceCounts[firstChoice] = (firstChoiceCounts[firstChoice] ?? 0) + 1;
        }
      }

      const totalVotes = rankings.filter(r => r.length > 0).length;
      if (totalVotes === 0) break;

      // Check for majority winner
      for (const [candidate, count] of Object.entries(firstChoiceCounts)) {
        if (count > totalVotes / 2) {
          winner = candidate;
          break;
        }
      }

      if (winner) break;

      // Find candidate with fewest votes and eliminate
      let minVotes = Infinity;
      let toEliminate: string | null = null;
      for (const [candidate, count] of Object.entries(firstChoiceCounts)) {
        if (count < minVotes) {
          minVotes = count;
          toEliminate = candidate;
        }
      }

      if (!toEliminate) break;

      // Remove eliminated candidate from all rankings
      for (const ranking of rankings) {
        const idx = ranking.indexOf(toEliminate);
        if (idx !== -1) {
          ranking.splice(idx, 1);
        }
      }

      // Prevent infinite loop
      if (roundsNeeded > 100) break;
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown: this.countFirstChoices(votes),
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded,
    };
  }

  private countFirstChoices(votes: Vote[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const vote of votes) {
      const firstChoice = vote.rank?.[0];
      if (firstChoice) {
        counts[firstChoice] = (counts[firstChoice] ?? 0) + 1;
      }
    }
    return counts;
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Veto voting - any member can veto a decision
 */
export class VetoVoting implements VotingStrategy {
  readonly method = 'veto' as const;

  tally(votes: Vote[]): VotingResult {
    // Check for vetoes first
    const vetoes = votes.filter(v => v.veto === true);
    if (vetoes.length > 0) {
      return {
        method: this.method,
        winner: null,
        votes,
        breakdown: this.countVotes(votes),
        confidenceAvg: this.averageConfidence(votes),
        consensusReached: false,
        roundsNeeded: 1,
        metadata: { 
          vetoedBy: vetoes.map(v => v.memberId),
          vetoReasons: vetoes.map(v => v.reasoning),
        },
      };
    }

    // No vetoes - use simple majority
    const breakdown = this.countVotes(votes);
    let winner: string | null = null;
    let maxCount = 0;

    for (const [position, count] of Object.entries(breakdown)) {
      if (count > maxCount) {
        winner = position;
        maxCount = count;
      }
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown,
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded: 1,
    };
  }

  private countVotes(votes: Vote[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const vote of votes) {
      counts[vote.position] = (counts[vote.position] ?? 0) + 1;
    }
    return counts;
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Confidence-based voting - weight by model confidence scores
 */
export class ConfidenceVoting implements VotingStrategy {
  readonly method = 'confidence' as const;

  tally(votes: Vote[]): VotingResult {
    const breakdown: Record<string, number> = {};

    for (const vote of votes) {
      breakdown[vote.position] = (breakdown[vote.position] ?? 0) + vote.confidence;
    }

    let winner: string | null = null;
    let maxConfidence = 0;

    for (const [position, totalConfidence] of Object.entries(breakdown)) {
      if (totalConfidence > maxConfidence) {
        winner = position;
        maxConfidence = totalConfidence;
      }
    }

    return {
      method: this.method,
      winner,
      votes,
      breakdown,
      confidenceAvg: this.averageConfidence(votes),
      consensusReached: winner !== null,
      roundsNeeded: 1,
    };
  }

  private averageConfidence(votes: Vote[]): number {
    if (votes.length === 0) return 0;
    return votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;
  }
}

/**
 * Create a voting strategy instance based on method
 */
export function createVotingStrategy(
  method: VotingMethod,
  options?: {
    memberWeights?: Map<string, number>;
    superMajorityThreshold?: number;
  }
): VotingStrategy {
  switch (method) {
    case 'majority':
      return new MajorityVoting();
    case 'super-majority':
      return new SuperMajorityVoting(options?.superMajorityThreshold);
    case 'weighted':
      return new WeightedVoting(options?.memberWeights ?? new Map());
    case 'ranked-choice':
      return new RankedChoiceVoting();
    case 'veto':
      return new VetoVoting();
    case 'confidence':
      return new ConfidenceVoting();
    case 'unanimous':
      return new SuperMajorityVoting(1.0); // 100% threshold
    case 'consensus':
      return new MajorityVoting(); // TODO: Implement iterative consensus
    default:
      throw new Error(`Unknown voting method: ${method}`);
  }
}
