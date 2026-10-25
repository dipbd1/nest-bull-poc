export const CONNECTION_TOOLS = [
  'database',
  'redis',
  'model',
  'mail',
  'identity',
] as const;
export type ConnectionTool = (typeof CONNECTION_TOOLS)[number];

export type ConnectionState = 'connected' | 'not_configured' | 'check_failed';

export type ConnectionDetails = Record<string, string | number | boolean | null>;

export type ConnectionView = {
  tool: ConnectionTool;
  label: string;
  state: ConnectionState;
  /** Non-secret facts such as hosts, ports, provider, and model. */
  details: ConnectionDetails;
  /** Short, secret-free explanation when the state is not `connected`. */
  message: string | null;
  checkedAt: string | null;
};

export function isConnectionTool(value: string): value is ConnectionTool {
  return (CONNECTION_TOOLS as readonly string[]).includes(value);
}
