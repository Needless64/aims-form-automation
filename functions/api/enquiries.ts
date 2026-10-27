import { handleEnquiry } from "../../lib/api/enquiries";
import { stringEnv, type PagesContext } from "../_lib/env";

// Pages only routes POST here; other methods get 405 from the platform.
export const onRequestPost = ({ request, env }: PagesContext) =>
  handleEnquiry(request, stringEnv(env));
