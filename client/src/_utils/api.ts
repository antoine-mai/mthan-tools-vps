import { runtime } from "../runtime";

export type ApiRoute = "apps" | "containers" | "login" | "session" | "system" | "tasking" | "userLimits";

export type ApiRouteMap = Record<ApiRoute, string>;

const rootApi: ApiRouteMap & { settings: string } = {
  apps: "/post/apps",
  containers: "/post/containers",
  login: "/post/login",
  session: "/post/session",
  settings: "/post/settings",
  system: "/post/system",
  tasking: "/post/tasking",
  userLimits: "/post/user/limits",
};

const userApi: ApiRouteMap = {
  apps: "/api/apps",
  containers: "/api/containers",
  login: "/api/login",
  session: "/api/session",
  system: "/api/system",
  tasking: "/api/tasking",
  userLimits: "/api/user/limits",
};

const Api = {
  root: rootApi,
  user: userApi,

  get current(): ApiRouteMap {
    return runtime.isRoot ? rootApi : userApi;
  },
};

export default Api;
