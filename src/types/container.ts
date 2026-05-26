export type DockerConnectionInfo = {
  connected: boolean;
  socketPath: string;
  dockerVersion: string;
  apiVersion: string;
};

export type ContainerPort = {
  privatePort: number;
  publicPort?: number;
  portType: string;
  ip?: string;
};

export type ContainerSummary = {
  id: string;
  names: string[];
  image: string;
  state:
    | "running"
    | "exited"
    | "created"
    | "paused"
    | "restarting"
    | "dead"
    | string;
  status: string;
  created: number;
  ports: ContainerPort[];
  labels: Record<string, string>;
};

export type OperationResult = {
  success: boolean;
  message?: string;
};
