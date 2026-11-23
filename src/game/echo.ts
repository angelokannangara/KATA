/**
 * KATA: Ink & Echo — Echo Recorder & Style Analyzer
 * Records player inputs across duels, extracts most-used combos, timing cadence,
 * stance habits, and favorite skills so the Echo Boss fights like the player.
 */

import { CONFIG } from './config';
import { EchoEvent, EchoProfile, EchoRecordedToken, StanceId } from './types';

export function createDefaultEchoProfile(): EchoProfile {
  return {
    totalEvents: 0,
    topCombos: [
      ['L', 'L', 'H'],
      ['D_FWD', 'L', 'SK0'],
      ['L', 'STANCE', 'H'],
    ],
    favoriteStance: 'crane',
    stanceWeights: { crane: 0.4, tiger: 0.35, serpent: 0.25 },
    aggressionRatio: 0.6,
    parryTendency: 0.25,
    dashFrequency: 0.2,
    favoriteSkillIndices: [0, 1, 2],
    avgActionIntervalMs: 420,
  };
}

export class EchoRecorder {
  private events: EchoEvent[] = [];

  constructor(initialEvents: EchoEvent[] = []) {
    this.events = initialEvents.slice(-CONFIG.maxEchoHistory);
  }

  public record(event: EchoEvent): void {
    this.events.push(event);
    if (this.events.length > CONFIG.maxEchoHistory) {
      this.events.shift();
    }
  }

  public getEvents(): EchoEvent[] {
    return this.events;
  }

  public clear(): void {
    this.events = [];
  }

  /**
   * Analyzes recorded events into a structured EchoProfile for the Echo Boss AI.
   */
  public analyze(): EchoProfile {
    if (this.events.length < CONFIG.echoMinEventsForCustom) {
      return {
        ...createDefaultEchoProfile(),
        totalEvents: this.events.length,
      };
    }

    const stanceCounts: Record<StanceId, number> = { crane: 1, tiger: 1, serpent: 1 };
    const skillCounts = [1, 1, 1];
    let attackCount = 0;
    let defensiveCount = 0;
    let parryUnderThreat = 0;
    let threatCount = 0;
    let dashCount = 0;
    let intervalSum = 0;
    let intervalSamples = 0;

    const comboCounts = new Map<string, number>();

    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i];
      stanceCounts[ev.stance] = (stanceCounts[ev.stance] ?? 0) + 1;

      if (ev.token === 'L' || ev.token === 'H' || ev.token === 'C' || ev.token === 'A') {
        attackCount++;
      } else if (ev.token === 'SK0') {
        attackCount++;
        skillCounts[0]++;
      } else if (ev.token === 'SK1') {
        attackCount++;
        skillCounts[1]++;
      } else if (ev.token === 'SK2') {
        attackCount++;
        skillCounts[2]++;
      } else if (ev.token === 'PARRY') {
        defensiveCount++;
        if (ev.oppAttacking) parryUnderThreat++;
      } else if (ev.token === 'D_FWD' || ev.token === 'D_BACK') {
        dashCount++;
        if (ev.token === 'D_BACK') defensiveCount++;
      }

      if (ev.oppAttacking) threatCount++;

      // Measure inter-action timing when actions belong to the same exchange (< 1600ms)
      if (i > 0) {
        const dt = ev.t - this.events[i - 1].t;
        if (dt > 50 && dt < 1600) {
          intervalSum += dt;
          intervalSamples++;
        }
      }

      // Extract 2-token and 3-token chains occurring within 1.15s windows
      if (i + 1 < this.events.length) {
        const dt1 = this.events[i + 1].t - ev.t;
        if (dt1 >= 0 && dt1 <= 900) {
          const seq2 = `${ev.token}>${this.events[i + 1].token}`;
          comboCounts.set(seq2, (comboCounts.get(seq2) ?? 0) + 1);

          if (i + 2 < this.events.length) {
            const dt2 = this.events[i + 2].t - this.events[i + 1].t;
            if (dt2 >= 0 && dt2 <= 900) {
              const seq3 = `${seq2}>${this.events[i + 2].token}`;
              comboCounts.set(seq3, (comboCounts.get(seq3) ?? 0) + 2);
            }
          }
        }
      }
    }

    const totalStance = stanceCounts.crane + stanceCounts.tiger + stanceCounts.serpent;
    const stanceWeights: Record<StanceId, number> = {
      crane: stanceCounts.crane / totalStance,
      tiger: stanceCounts.tiger / totalStance,
      serpent: stanceCounts.serpent / totalStance,
    };

    let favoriteStance: StanceId = 'crane';
    if (stanceWeights.tiger > stanceWeights[favoriteStance]) favoriteStance = 'tiger';
    if (stanceWeights.serpent > stanceWeights[favoriteStance]) favoriteStance = 'serpent';

    const sortedCombos = [...comboCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key]) => key.split('>'));

    const fallback = createDefaultEchoProfile().topCombos;
    const topCombos = sortedCombos.length >= 2 ? sortedCombos : fallback;

    const favoriteSkillIndices = [0, 1, 2].sort((a, b) => skillCounts[b] - skillCounts[a]);

    const totalActs = Math.max(1, attackCount + defensiveCount);
    const aggressionRatio = Math.max(0.25, Math.min(0.92, attackCount / totalActs));
    const parryTendency =
      threatCount > 0
        ? Math.max(0.1, Math.min(0.85, parryUnderThreat / threatCount))
        : Math.max(0.1, Math.min(0.6, defensiveCount / totalActs));
    const dashFrequency = Math.max(0.08, Math.min(0.65, dashCount / this.events.length));
    const avgActionIntervalMs =
      intervalSamples > 0
        ? Math.max(180, Math.min(850, Math.round(intervalSum / intervalSamples)))
        : 420;

    return {
      totalEvents: this.events.length,
      topCombos,
      favoriteStance,
      stanceWeights,
      aggressionRatio,
      parryTendency,
      dashFrequency,
      favoriteSkillIndices,
      avgActionIntervalMs,
    };
  }
}

export function describeEchoProfile(profile: EchoProfile): string {
  const comboTxt = (profile.topCombos[0] ?? ['L', 'L', 'H'])
    .map(formatTokenLabel)
    .join(' → ');
  const styleWord =
    profile.aggressionRatio > 0.68
      ? 'Aggressive'
      : profile.parryTendency > 0.42
        ? 'Counter'
        : 'Balanced';
  const stanceLabel =
    profile.favoriteStance.charAt(0).toUpperCase() + profile.favoriteStance.slice(1);
  return `${stanceLabel} · ${styleWord} · ${comboTxt}`;
}

export function formatTokenLabel(token: EchoRecordedToken | string): string {
  switch (token) {
    case 'L':
      return 'Light';
    case 'H':
      return 'Heavy';
    case 'C':
      return 'Low';
    case 'A':
      return 'Air';
    case 'D_FWD':
      return 'Dash In';
    case 'D_BACK':
      return 'Backstep';
    case 'PARRY':
      return 'Parry';
    case 'SK0':
      return 'Skill U';
    case 'SK1':
      return 'Skill I';
    case 'SK2':
      return 'Skill O';
    case 'STANCE':
      return 'Weave';
    default:
      return token;
  }
}
