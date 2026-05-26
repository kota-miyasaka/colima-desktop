export type ComposeService = {
  name: string;
  containerId: string;
  state: string;
  status: string;
};

export type ComposeProject = {
  name: string;
  workingDir: string;
  configFiles: string;
  services: ComposeService[];
};
