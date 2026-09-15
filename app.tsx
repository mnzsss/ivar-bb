import { definePluginApp } from "@get-bb/plugin-sdk/app";

function IvarPanel() {
  return <div>ivar</div>;
}

export default definePluginApp((app) =>
  app.slots.navPanel({ id: "ivar", title: "ivar", icon: "Network", path: "ivar", component: IvarPanel }),
);
