export interface ToolRefInput {
  tool: string;
  repository?: string;
  ref: string;
  name?: string;
  fixture?: string;
  expected?: { semicolons: string; quoteStyle: string };
}
export interface ToolRef extends ToolRefInput {
  repo: string;
  commit: string;
  name: string;
  fixture: string;
  pr?: string;
}
export function resolveToolRef(
  input: ToolRefInput,
  api?: (endpoint: string) => unknown | Promise<unknown>,
  registry?: Record<
    string,
    { repository: string; fixture: string; native: object }
  >,
): Promise<ToolRef>;
export function stageToolRef(
  resolved: ToolRef,
  binaries: string,
  site: string,
  resolver: string,
): Promise<void>;
