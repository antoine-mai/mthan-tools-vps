import { runtime } from "../runtime";

export type ApiRoute = "login";

export type ApiRouteMap = Record<ApiRoute, string>;

const rootApi: ApiRouteMap = {
  login: "/post/login",
};

const userApi: ApiRouteMap = {
  login: "/api/login",
};

const Api = {
  root: rootApi,
  user: userApi,

  get current(): ApiRouteMap {
    return runtime.isRoot ? rootApi : userApi;
  },
};

export default Api;
