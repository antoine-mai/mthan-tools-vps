import { runtime } from "../runtime";

export type ApiRoute = "login" | "session";

export type ApiRouteMap = Record<ApiRoute, string>;

const rootApi: ApiRouteMap = {
  login: "/post/login",
  session: "/post/session",
};

const userApi: ApiRouteMap = {
  login: "/api/login",
  session: "/api/session",
};

const Api = {
  root: rootApi,
  user: userApi,

  get current(): ApiRouteMap {
    return runtime.isRoot ? rootApi : userApi;
  },
};

export default Api;
