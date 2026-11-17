import { z } from "zod";
import type { AuthContext } from "./auth";

export const ContextSchema = z.custom<AuthContext>();

export type Context = AuthContext;
