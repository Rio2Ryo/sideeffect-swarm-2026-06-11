import { describe, expect, it } from 'vitest';
import {
  advanceTick,
  applyAction,
  calculateEcosystemStability,
  createSwarmBox,
  exportSnapshot,
  injectWeird,
  runScenario,
  sanitizeWeirdInput,
} from '../domain/swarm';

describe('sideeffect swarm domain', () => {
  it('is deterministic by seed', () => {
    expect(createSwarmBox('morning-ryo')).toEqual(createSwarmBox('morning-ryo'));
    expect(createSwarmBox('morning-ryo')).not.toEqual(createSwarmBox('another-seed'));
  });

  it('repair actions create visible side effects', () => {
    const state = applyAction(createSwarmBox('morning-ryo'), 'seal-queue');
    const retry = state.swarms.find((swarm) => swarm.kind === 'retry-larvae');
    expect(retry?.to).toBe('billing');
    expect(state.logs[0]).toContain('Billing');
  });

  it('canary wasps improve the readability of swarm will', () => {
    const before = createSwarmBox('morning-ryo');
    const after = applyAction(before, 'release-canary-wasps');
    expect(after.swarms.some((swarm) => swarm.kind === 'canary-wasps')).toBe(true);
    expect(after.swarmWill).not.toEqual(before.swarmWill);
  });

  it('ticks move ecology while staying bounded', () => {
    const state = advanceTick(createSwarmBox('morning-ryo'));
    expect(state.tick).toBe(1);
    expect(calculateEcosystemStability(state)).toBeGreaterThanOrEqual(0);
    expect(calculateEcosystemStability(state)).toBeLessThanOrEqual(100);
  });

  it('sanitizes weird input and stores it inertly', () => {
    const clean = sanitizeWeirdInput('<script>alert(1)</script>\u202E');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
    const state = injectWeird(createSwarmBox('x'), '<img src=x onerror=alert(1)>');
    expect(state.weirdInputs[0]).toContain('event=alert(1)');
    expect(state.logs[0]).not.toContain('<img');
  });

  it('exports JSON safe snapshots and meaningful scenario results', () => {
    const snapshot = exportSnapshot(runScenario('morning-ryo'));
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(snapshot.actions.length).toBeGreaterThan(3);
    expect(snapshot.ecosystemStability).toBeGreaterThan(35);
    expect(snapshot.ending).toMatch(/ecosystem|repair|swarm/i);
  });
});
