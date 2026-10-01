export type RuntimeMode = "root" | "user";

export type ClientRuntime = {
  basePath: string;
  env: string;
  isRoot: boolean;
  mode: RuntimeMode;
  osName: string;
  osBranch: string;
  uid: number;
  username: string;
};

declare global {
  interface Window {
    __VPS_RUNTIME__?: ClientRuntime;
  }
}

export const runtime: ClientRuntime = window.__VPS_RUNTIME__ ?? {
  basePath: "",
  env: "development",
  isRoot: false,
  mode: "user",
  osName: "Linux",
  osBranch: "other",
  uid: -1,
  username: "",
};
