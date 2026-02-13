export type CustomOption = {
  value: string;
  text: string;
};

export type SideLink = {
  type: string;
  url: string;
};

export type Project = {
  id: number;
  name: string;
  code: string;
  link: string;
  sideLinks: SideLink[];
  logo: string;
  initial: string;
  favorite: boolean;
  taskType: string[];
  connectType: string[];
  taskCost: number;
  taskTime: number;
  status: string;
  statusDate: string;
  note: string;
  rewardType: string[];
  logos: unknown[];
  lastEdited: number;
};

export type LegacyPayload = {
  projects: Project[];
  customOptions: Record<string, CustomOption[]>;
  lastUpdatedAt: number;
  lastAutoBackupAt?: number;
  savedAt: number;
};
