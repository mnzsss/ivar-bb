import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { addComment, listComments, resolveComment, sendToThreads, type SpawnThread } from "./comments.js";
import { featureDiff } from "./diff.js";
import { exec, fsExists, resolveBinary, type Exec } from "./exec.js";
import { findHallRoot, getHall, runIvar } from "./hall.js";
import { ivarRpcContract } from "./rpc.js";

export default async function plugin(bb: BbPluginApi): Promise<void> {
  const ivarBin = await resolveBinary("ivar");
  const run: Exec = (cmd, args, cwd) => exec(cmd === "ivar" ? ivarBin : cmd, args, cwd);

  const projectSource = async (projectId: string) => {
    const { sources } = await bb.sdk.projects.get({ projectId });
    const source = sources.find((entry) => entry.isDefault) ?? sources[0];
    if (!source) throw new Error(`Project ${projectId} has no source checkout`);
    return source;
  };
  const hallRoot = async (projectId: string) => {
    const root = await findHallRoot((await projectSource(projectId)).path, fsExists);
    if (!root) throw new Error("No ivar hall found for this project");
    return root;
  };

  bb.rpc.register(ivarRpcContract, {
    "hall.get": async ({ projectId }) => getHall((await projectSource(projectId)).path, run, fsExists),
    "hall.run": async ({ projectId, ...command }) => runIvar(await hallRoot(projectId), command, run),
    "feature.diff": async ({ projectId, feature }) => featureDiff(await hallRoot(projectId), feature, run),
    "comments.list": async ({ projectId, feature }) => ({ comments: await listComments(await hallRoot(projectId), feature, run) }),
    "comments.add": async ({ projectId, feature, ...input }) => addComment(await hallRoot(projectId), feature, input, run),
    "comments.resolve": async ({ projectId, feature, id }) => resolveComment(await hallRoot(projectId), feature, id, run),
    "comments.send": async ({ projectId, feature }) => {
      const source = await projectSource(projectId);
      const spawn: SpawnThread = ({ worktree, prompt, title }) =>
        bb.sdk.threads
          .spawn({ projectId, prompt, title, environment: { type: "host", hostId: source.hostId, workspace: { type: "unmanaged", path: worktree } } })
          .then((thread) => ({ threadId: thread.id }));
      return { threads: await sendToThreads(await hallRoot(projectId), feature, run, spawn, ivarBin) };
    },
  });
}
