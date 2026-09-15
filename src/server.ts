import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { addComment, listComments, resolveComment, sendToThreads, type SpawnThread } from "./comments.js";
import { featureDiff } from "./diff.js";
import { exec, fsExists, resolveBinary } from "./exec.js";
import { findHallRoot, getHall, runIvar } from "./hall.js";
import { ivarRpcContract } from "./rpc.js";

export default async function plugin(bb: BbPluginApi): Promise<void> {
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
    ping: async () => ({ ok: true as const }),
    "hall.get": async ({ projectId }) => getHall((await projectSource(projectId)).path, exec, fsExists),
    "hall.run": async ({ projectId, command, args }) => runIvar(await hallRoot(projectId), command, args, exec),
    "feature.diff": async ({ projectId, feature }) => ({ files: await featureDiff(await hallRoot(projectId), feature, exec) }),
    "comments.list": async ({ projectId, feature }) => ({ comments: await listComments(await hallRoot(projectId), feature, exec) }),
    "comments.add": async ({ projectId, feature, ...input }) => addComment(await hallRoot(projectId), feature, input, exec),
    "comments.resolve": async ({ projectId, feature, id }) => resolveComment(await hallRoot(projectId), feature, id, exec),
    "comments.send": async ({ projectId, feature }) => {
      const source = await projectSource(projectId);
      const spawn: SpawnThread = ({ worktree, prompt, title }) =>
        bb.sdk.threads
          .spawn({ projectId, prompt, title, environment: { type: "host", hostId: source.hostId, workspace: { type: "unmanaged", path: worktree } } })
          .then((thread) => ({ threadId: thread.id }));
      return { threads: await sendToThreads(await hallRoot(projectId), feature, exec, spawn, await resolveBinary("ivar")) };
    },
  });
}
