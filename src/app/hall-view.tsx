import { useCallback, useState } from "react";
import { useBbNavigate, useRpc } from "@get-bb/plugin-sdk/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ivarRpcContract } from "../rpc.js";
import type { HallCommand } from "../hall.js";
import type { ExecResult as RunResult } from "../exec.js";
import type { HallView as HallData } from "../schemas.js";
import { hallSummary } from "./hall-model.js";
import { reuseIfEqual } from "./review-model.js";
import { usePolling } from "./use-polling.js";

export function HallView({ projectId }: { projectId: string }) {
  const rpc = useRpc<typeof ivarRpcContract>();
  const navigate = useBbNavigate();
  const [hall, setHall] = useState<HallData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [newFeature, setNewFeature] = useState("");

  const refresh = useCallback(
    () =>
      rpc.call("hall.get", { projectId }).then(
        (h) => {
          setHall((previous) => (previous ? reuseIfEqual(previous, h) : h));
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
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

  if (!hall) return <p className="p-4 text-sm text-muted-foreground">{error ?? "Loading…"}</p>;
  const summary = hallSummary(hall);

  return (
    <div className="flex flex-col gap-4 p-4 text-sm text-foreground">
      <header className="flex items-center justify-between gap-2">
        <h2 className="m-0 truncate text-sm font-semibold">{summary.title}</h2>
        {!summary.empty && (
          <Button variant="outline" size="sm" onClick={() => run({ command: "sync" })}>
            Sync
          </Button>
        )}
      </header>
      {error && (
        <p role="alert" className="m-0 text-destructive">
          {error}
        </p>
      )}
      {summary.empty ? (
        <p className="m-0 text-muted-foreground">{summary.empty}</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Repos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1">
              {summary.repos.map((repo) => (
                <Badge key={repo} variant="secondary">
                  {repo}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Features</CardTitle>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFeature.trim())
                    void run({ command: "feature create", name: newFeature.trim() }).then(() =>
                      setNewFeature(""),
                    );
                }}
              >
                <Input
                  className="h-8 w-48"
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="New feature"
                  aria-label="New feature"
                />
                <Button type="submit" size="sm">
                  Create
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Promoted</TableHead>
                    <TableHead>Promote</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.features.map((feature) => (
                    <TableRow key={feature.name}>
                      <TableCell className="font-medium">{feature.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {feature.promoted.map((repo) => (
                            <Badge key={repo} variant="outline">
                              {repo}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {summary.repos
                            .filter((repo) => !feature.promoted.includes(repo))
                            .map((repo) => (
                              <Button
                                key={repo}
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  run({ command: "promote", feature: feature.name, repo })
                                }
                              >
                                + {repo}
                              </Button>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate.toPluginPanel("ivar", {
                              subPath: `${encodeURIComponent(projectId)}/${feature.href}`,
                            })
                          }
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
      {lastRun && (
        <pre className="m-0 overflow-auto rounded-md border border-border bg-muted p-2 text-xs">{`exit ${lastRun.code}\n${lastRun.stdout}${lastRun.stderr}`}</pre>
      )}
    </div>
  );
}
