import { useCallback, useState } from "react";
import { useBbNavigate, useRpc } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { HallCommand } from "../hall.js";
import type { ExecResult as RunResult } from "../exec.js";
import type { HallView as HallData } from "../schemas.js";
import { hallSummary } from "./hall-model.js";
import { usePolling } from "./use-polling.js";

export function HallView({ projectId }: { projectId: string }) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const navigate = useBbNavigate();
  const [hall, setHall] = useState<HallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const refresh = useCallback(
    () => rpc.call("hall.get", { projectId }).then((h) => { setHall(h); setError(null); }, (e: Error) => setError(e.message)),
    [rpc, projectId],
  );

  usePolling(refresh, 2000);

  const run = async (command: HallCommand) => {
    try {
      setLastRun(await rpc.call("hall.run", { projectId, ...command }));
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
  };

  if (!hall) return <div style={{ padding: 16 }}>{error ?? "Loading…"}</div>;
  const summary = hallSummary(hall);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>{summary.title}</h2>
        {!summary.empty && <button onClick={() => run({ command: "sync" })}>sync</button>}
      </header>
      {error && <p role="alert">{error}</p>}
      {summary.empty ? (
        <p>{summary.empty}</p>
      ) : (
        <>
          <section>
            <h3>Repos</h3>
            <ul>{summary.repos.map((repo) => <li key={repo}>{repo}</li>)}</ul>
          </section>
          <section>
            <h3>Features</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newFeature.trim()) void run({ command: "feature create", name: newFeature.trim() }).then(() => setNewFeature(""));
              }}
            >
              <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="New feature" />
              <button type="submit">Create</button>
            </form>
            <table style={{ borderSpacing: "12px 4px" }}>
              <thead>
                <tr><th>Name</th><th>Promoted</th><th>Promote</th><th /></tr>
              </thead>
              <tbody>
                {summary.features.map((feature) => (
                  <tr key={feature.name}>
                    <td>{feature.name}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {feature.promoted.map((repo) => (
                          <span key={repo} style={{ padding: "0 6px", border: "1px solid currentColor", borderRadius: 10 }}>{repo}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {summary.repos.filter((repo) => !feature.promoted.includes(repo)).map((repo) => (
                          <button key={repo} onClick={() => run({ command: "promote", feature: feature.name, repo })}>{repo}</button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button onClick={() => navigate.toPluginPanel("ivar", { subPath: `${encodeURIComponent(projectId)}/${feature.href}` })}>Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {lastRun && (
        <pre>{`exit ${lastRun.code}\n${lastRun.stdout}${lastRun.stderr}`}</pre>
      )}
    </div>
  );
}
