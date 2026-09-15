import { useCallback, useEffect, useState } from "react";
import { useBbNavigate, useRpc } from "@get-bb/plugin-sdk/app";
import type { ivarRpcContract } from "../rpc.js";
import type { AllowedCommand, HallView as HallData } from "../hall.js";
import { hallSummary } from "./hall-model.js";

type RunResult = { code: number; stdout: string; stderr: string };

export function HallView({ projectId }: { projectId: string }) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const navigate = useBbNavigate();
  const [hall, setHall] = useState<HallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const refresh = useCallback(
    () => rpc.call("hall.get", { projectId }).then(setHall, (e: Error) => setError(e.message)),
    [rpc, projectId],
  );

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = async (command: AllowedCommand, args: string[]) => {
    try {
      setLastRun(await rpc.call("hall.run", { projectId, command, args }));
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
        {!summary.empty && <button onClick={() => run("sync", [])}>sync</button>}
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
                if (newFeature.trim()) void run("feature create", [newFeature.trim()]).then(() => setNewFeature(""));
              }}
            >
              <input value={newFeature} onChange={(e) => setNewFeature(e.target.value)} placeholder="New feature" />
              <button type="submit">Create</button>
            </form>
            <table>
              <thead>
                <tr><th>Name</th><th>Repos</th><th /></tr>
              </thead>
              <tbody>
                {summary.features.map((feature) => (
                  <tr key={feature.name}>
                    <td>{feature.name}</td>
                    <td>
                      {summary.repos.map((repo) =>
                        feature.promoted.includes(repo) ? (
                          <span key={repo} style={{ marginRight: 6 }}>{repo}</span>
                        ) : (
                          <button key={repo} onClick={() => run("promote", [feature.name, repo])}>Promote {repo}</button>
                        ),
                      )}
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
