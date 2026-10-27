import { handleRetry } from "../../../lib/api/retry";
import { stringEnv, type PagesContext } from "../../_lib/env";

export const onRequestPost = ({ request, env }: PagesContext) =>
  handleRetry(request, stringEnv(env));
