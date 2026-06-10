import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import {
  actions,
  advanceTick,
  applyAction,
  createSwarmBox,
  exportSnapshot,
  getActionLabel,
  injectWeird,
  isActionId,
  runScenario,
  sanitizeSeed,
} from './domain/swarm';
import type { SwarmState } from './domain/types';

const initialSeed = sanitizeSeed(new URLSearchParams(window.location.search).get('seed'));

function buildShareUrl(seed: string) {
  const url = new URL(`${window.location.origin}${window.location.pathname}`);
  url.searchParams.set('seed', seed);
  return url.toString();
}

function App() {
  const [state, setState] = useState<SwarmState>(() => createSwarmBox(initialSeed));
  const stateRef = useRef(state);
  const [selectedSwarm, setSelectedSwarm] = useState<string | null>(null);
  const [weird, setWeird] = useState('');
  const [copied, setCopied] = useState('');

  const snapshot = useMemo(() => exportSnapshot(state), [state]);
  const leader = [...state.swarms].sort((a, b) => b.population - a.population)[0];
  const shareUrl = buildShareUrl(state.seed);

  function commit(next: SwarmState) {
    stateRef.current = next;
    setState(next);
    return next;
  }

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    window.__SWARM_BOX__ = {
      getState: () => stateRef.current,
      reset: (seed?: string) => commit(createSwarmBox(seed || stateRef.current.seed)),
      action: (id: string) => {
        const action = isActionId(id) ? id : 'negotiate-with-swarm';
        return commit(applyAction(stateRef.current, action));
      },
      tick: () => commit(advanceTick(stateRef.current)),
      scenario: (seed?: string) => commit(runScenario(seed || stateRef.current.seed)),
      weird: (input: string) => commit(injectWeird(stateRef.current, input)),
      export: () => exportSnapshot(stateRef.current),
      shareUrl: () => buildShareUrl(stateRef.current.seed),
    };
    return () => {
      delete window.__SWARM_BOX__;
    };
  });

  async function copyJson() {
    const text = JSON.stringify(snapshot, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied('JSONをclipboardにコピーした');
    } catch {
      setCopied('clipboard不可。下のJSONを手動コピーして');
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied('共有URLをコピーした');
    } catch {
      setCopied(shareUrl);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="title">
        <div>
          <p className="eyebrow">2026-06-11 morning build / deterministic seed: {state.seed}</p>
          <h1 id="title">Sideeffect Swarm</h1>
          <p className="lead">副作用群体は、修復後に意思を持つ。根絶ではなく、生態系として運用する小さな事故後箱庭。</p>
        </div>
        <div className="verdict-card" aria-label="current ecosystem verdict">
          <span>群れの投票</span>
          <strong>{state.ecosystemStability}</strong>
          <small>repair {state.repairProgress} / tick {state.tick}</small>
        </div>
      </section>

      <section className="swarm-will" aria-live="polite">
        <strong>Swarm will:</strong> {state.swarmWill}
      </section>

      <section className="grid">
        <div className="panel sandbox" aria-label="service and swarm sandbox">
          <div className="map">
            {state.services.map((service) => (
              <article
                key={service.id}
                className="service-node"
                style={{ left: `${service.x}%`, top: `${service.y}%` }}
                aria-label={`${service.label} health ${service.health} pressure ${service.pressure}`}
              >
                <span className="node-name">{service.label}</span>
                <span className="health">H{service.health}</span>
                <span className="pressure">P{service.pressure}</span>
              </article>
            ))}
            {state.swarms.map((swarm, index) => {
              const from = state.services.find((service) => service.id === swarm.from) ?? state.services[0];
              const to = state.services.find((service) => service.id === swarm.to) ?? state.services[1];
              const x = from.x + (to.x - from.x) * 0.58 + ((index % 3) - 1) * 3;
              const y = from.y + (to.y - from.y) * 0.58 + ((index % 2) - 0.5) * 5;
              return (
                <button
                  key={swarm.id}
                  className={`swarm-orb ${selectedSwarm === swarm.id ? 'selected' : ''}`}
                  style={{ '--swarm-color': swarm.color, left: `${x}%`, top: `${y}%`, width: `${Math.max(34, Math.min(90, swarm.population))}px` } as React.CSSProperties}
                  onClick={() => setSelectedSwarm(swarm.id)}
                  aria-label={`${swarm.kind} population ${swarm.population}`}
                  aria-pressed={selectedSwarm === swarm.id}
                >
                  <span>{swarm.population}</span>
                </button>
              );
            })}
          </div>
          <div className="map-caption">
            <strong>{leader.kind}</strong> が主導権を握り、{leader.from}→{leader.to} へ {leader.intent} 中。
          </div>
        </div>

        <div className="panel controls">
          <h2>手を入れる</h2>
          <div className="button-grid">
            {actions.map((action) => (
              <button key={action} onClick={() => setState((prev) => applyAction(prev, action))}>
                {getActionLabel(action)}
              </button>
            ))}
          </div>
          <button className="secondary" onClick={() => setState((prev) => advanceTick(prev))}>1 tick 観察</button>
          <button className="secondary" onClick={() => setState(runScenario(state.seed))}>Hermes scenario再生</button>
          <button className="secondary" onClick={() => setState(createSwarmBox(state.seed))}>同じseedでリセット</button>
          <label className="weird-input">
            変な入力を隔離する
            <input value={weird} onChange={(event) => setWeird(event.target.value)} placeholder={'<svg onload=alert(1)>'} />
          </label>
          <button onClick={() => { setState((prev) => injectWeird(prev, weird)); setWeird(''); }}>隔離して観察</button>
          {copied && <p className="copied" role="status">{copied}</p>}
        </div>

        <div className="panel ledger">
          <h2>群体台帳</h2>
          {state.swarms.map((swarm) => (
            <button key={swarm.id} className="swarm-row" onClick={() => setSelectedSwarm(swarm.id)}>
              <span className="dot" style={{ background: swarm.color }} />
              <span>{swarm.kind}</span>
              <small>{swarm.from}→{swarm.to} / pop {swarm.population} / {swarm.intent}</small>
            </button>
          ))}
          <div className="swarm-detail">
            {selectedSwarm ? (
              (() => {
                const swarm = state.swarms.find((item) => item.id === selectedSwarm);
                return swarm ? <p>{swarm.note} aggression {swarm.aggression}, mutation {swarm.mutation}</p> : <p>選択した群れは移住済み。</p>;
              })()
            ) : (
              <p>群れをクリックすると、癖・繁殖・競合の説明が出る。</p>
            )}
          </div>
        </div>

        <div className="panel log-panel">
          <h2>Evidence log</h2>
          <ol>
            {state.logs.map((log) => <li key={log}>{log}</li>)}
          </ol>
        </div>
      </section>

      <section className="panel export-panel">
        <div>
          <h2>AI操作面</h2>
          <code>window.__SWARM_BOX__.action('seal-queue')</code>
          <code>window.__SWARM_BOX__.scenario('morning-ryo')</code>
          <code>window.__SWARM_BOX__.weird('&lt;script&gt;alert(1)&lt;/script&gt;')</code>
        </div>
        <div className="export-buttons">
          <button onClick={copyJson}>Export JSON</button>
          <button onClick={copyShareUrl}>Share URL</button>
        </div>
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </section>
    </main>
  );
}

export default App;

declare global {
  interface Window {
    __SWARM_BOX__?: {
      getState: () => SwarmState;
      reset: (seed?: string) => SwarmState;
      action: (id: string) => SwarmState;
      tick: () => SwarmState;
      scenario: (seed?: string) => SwarmState;
      weird: (input: string) => SwarmState;
      export: () => ReturnType<typeof exportSnapshot>;
      shareUrl: () => string;
    };
  }
}
