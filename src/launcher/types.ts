export type AppEntry = {
  id: string;
  name: string;
  path: string;
  args?: string;
  addedAt: number;
};

export type Group = {
  id: string;
  name: string;
  apps: AppEntry[];
};

export type LauncherState = {
  version: 1;
  activeGroupId: string;
  groups: Group[];
};
