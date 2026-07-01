export type RuntimeMode = "root" | "user";

export type ClientRuntime = {
  env: string;
  isRoot: boolean;
  mode: RuntimeMode;
  uid: number;
  username: string;
};

declare global {
  interface Window {
    __VPS_RUNTIME__?: ClientRuntime;
  }
}

export const runtime: ClientRuntime = window.__VPS_RUNTIME__ ?? {
  env: "development",
  isRoot: false,
  mode: "user",
  uid: -1,
  username: "",
};
