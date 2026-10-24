import { useCallback, useEffect, useState } from "react";

type SignalSummary = {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  extraction_method: string;
  created_at: string;
};

type Canonical = {
  signal: {
    id: string;
    symbol: string;
    direction: string;
    timeframe: { value: number; unit: string };
    entry_zone: { low: number; high: number };
    stop_loss: { price: number };
    take_profit_zones: { id: string; low: number; high: number }[];
  };
  workflow: { status: string; approved_at?: string; approved_by?: string };
  extraction: { method: string; parser_version?: string; model?: string };
  derived?: { entry_midpoint: number; risk_distance: number; risk_rewards: number[] };
};

type Detail = {
  ok: boolean;
  signal: Canonical;
  pngUrl: string;
  publications: { platform: string; status: string; error_message?: string; errorMessage?: string; externalPostId?: string }[];
  revisions: { revision: number; changeInfo: string; createdAt: string }[];
  audit: { type: string; createdAt: string }[];
};

const SAMPLE = `SHORT XAUUSD 30m
Entry: 4116-4129
SL: 4135
TP1: 4092-4104
TP2: 4016-4020`;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  return (await res.json()) as T;
}

export function App() {
  const [text, setText] = useState(SAMPLE);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<SignalSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editText, setEditText] = useState("Change SL to 4137");
  const [stats, setStats] = useState<{ signals: number; deterministicPct: number; publicationSucceeded: number } | null>(
    null
  );
  const [nonce, setNonce] = useState(0);

  const refreshList = useCallback(async () => {
    const [rows, s] = await Promise.all([json<SignalSummary[]>("/api/signals"), json<typeof stats>("/api/stats")]);
    setList(rows);
    setStats(s);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const d = await json<Detail>(`/api/signals/${id}`);
    setDetail(d);
    setSelectedId(id);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let result: { ok: boolean; signal?: Canonical; issues?: string };
      if (file) {
        const fd = new FormData();
        fd.append("text", text);
        fd.append("editor", "operator");
        fd.append("image", file);
        const res = await fetch("/api/signals", { method: "POST", body: fd });
        result = await res.json();
      } else {
        result = await json("/api/signals", { method: "POST", body: JSON.stringify({ text, editor: "operator" }) });
      }
      if (!result.ok || !result.signal) {
        setError(result.issues ?? "Extraction or validation failed");
        return;
      }
      await refreshList();
      await loadDetail(result.signal.signal.id);
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, body?: unknown) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await json<{ ok: boolean; issues?: string; signal?: Canonical }>(path, {
        method: "POST",
        body: JSON.stringify(body ?? {})
      });
      if (!result.ok) setError(result.issues ?? "Action failed");
      await refreshList();
      await loadDetail(selectedId);
    } finally {
      setBusy(false);
    }
  }

  const awaiting = detail?.signal.workflow.status === "AWAITING_APPROVAL";

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Phase 1 vertical slice</p>
          <h1>Signal Desk</h1>
        </div>
        <div className="metrics">
          <div>
            <span>Signals</span>
            <strong>{stats?.signals ?? 0}</strong>
          </div>
          <div>
            <span>Deterministic</span>
            <strong>{stats?.deterministicPct ?? 0}%</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{stats?.publicationSucceeded ?? 0}</strong>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="compose">
          <h2>Compose</h2>
          <p className="hint">
            Known shorthand with no chart uses the deterministic parser. Attach a chart or write freeform text to route
            through AI.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} />
          <label className="file">
            Optional chart
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button disabled={busy} onClick={() => void submit()}>
            {busy ? "Processing…" : "Extract, validate, render"}
          </button>
          {error && <div className="error">{error}</div>}

          <h2>Queue</h2>
          <ul className="queue">
            {list.map((row) => (
              <li key={row.id}>
                <button className={row.id === selectedId ? "active" : ""} onClick={() => void loadDetail(row.id)}>
                  <strong>
                    {row.direction} {row.symbol}
                  </strong>
                  <span>
                    {row.id} · {row.status} · {row.extraction_method}
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="empty">No signals yet</li>}
          </ul>
        </section>

        <section className="preview">
          {!detail && <div className="empty-panel">Submit a signal to preview the card, JSON, and approval actions.</div>}
          {detail && (
            <>
              <div className="preview-head">
                <div>
                  <h2>{detail.signal.signal.id}</h2>
                  <p>
                    {detail.signal.workflow.status} · extraction {detail.signal.extraction.method}
                    {detail.signal.extraction.parser_version ? ` · ${detail.signal.extraction.parser_version}` : ""}
                  </p>
                </div>
                <div className="actions">
                  <button disabled={!awaiting || busy} onClick={() => void act(`/api/signals/${selectedId}/approve`)}>
                    Confirm & publish
                  </button>
                  <button disabled={!awaiting || busy} onClick={() => void act(`/api/signals/${selectedId}/regenerate`)}>
                    Regenerate
                  </button>
                  <button disabled={!awaiting || busy} onClick={() => void act(`/api/signals/${selectedId}/cancel`)}>
                    Cancel
                  </button>
                </div>
              </div>
              <div className="preview-grid">
                <figure>
                  <iframe title="Rendered trading signal card" src={`/assets/${selectedId}.html?v=${nonce}`} />
                </figure>
                <div className="facts">
                  <dl>
                    <div>
                      <dt>Setup</dt>
                      <dd>
                        {detail.signal.signal.direction} {detail.signal.signal.symbol} {detail.signal.signal.timeframe.value}{" "}
                        {detail.signal.signal.timeframe.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Entry</dt>
                      <dd>
                        {detail.signal.signal.entry_zone.low} – {detail.signal.signal.entry_zone.high}
                      </dd>
                    </div>
                    <div>
                      <dt>Stop</dt>
                      <dd>{detail.signal.signal.stop_loss.price}</dd>
                    </div>
                    {detail.signal.signal.take_profit_zones.map((z) => (
                      <div key={z.id}>
                        <dt>{z.id}</dt>
                        <dd>
                          {z.low} – {z.high}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="edit-row">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <button
                      disabled={!awaiting || busy}
                      onClick={() => void act(`/api/signals/${selectedId}/edit`, { instruction: editText })}
                    >
                      Apply edit
                    </button>
                  </div>
                  <h3>Publications</h3>
                  <ul>
                    {(detail.publications ?? []).map((p, i) => (
                      <li key={i}>
                        {p.platform}: {p.status}
                        {p.externalPostId ? ` · ${p.externalPostId}` : ""}
                      </li>
                    ))}
                    {detail.publications?.length === 0 && <li>None yet</li>}
                  </ul>
                  <h3>Audit</h3>
                  <ul className="audit">
                    {(detail.audit ?? []).map((a, i) => (
                      <li key={i}>
                        {a.type} · {a.createdAt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
