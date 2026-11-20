export type MemberDTO = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
};

export type TagDTO = { id: string; name: string; color: string };

export type FieldDTO = {
  id: string;
  name: string;
  type: string;
  options: string[];
  required: boolean;
};

export type MilestoneDTO = { id: string; name: string; date: string };

export type TaskDTO = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate: string | null;
  assignees: { id: string; name: string; avatarUrl: string | null }[];
  tags: TagDTO[];
  values: Record<string, string | null>;
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  position: number;
  createdAt: string;
  completedAt: string | null;
  description: string | null;
  milestoneId: string | null;
};

export type TaskNode = TaskDTO & { children: TaskNode[] };

export type ProjectMeta = {
  id: string;
  name: string;
  color: string;
  privacy: string;
  archived: boolean;
  workspaceSlug: string;
  canEdit: boolean;
  isGuest: boolean;
  isProjectAdmin: boolean;
  readOnly: boolean;
  currentUserId: string;
  members: MemberDTO[];
  tags: TagDTO[];
  fields: FieldDTO[];
  milestones: MilestoneDTO[];
};

export type ViewFilters = {
  status: string[];
  assignee: string;
  priority: string;
  tag: string;
  due: string;
  q: string;
  sort: string;
  group: string;
  fields: Record<string, string>;
};

export type DrawerComment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  editedAt: string | null;
  canModify: boolean;
  canDelete: boolean;
};

export type DrawerActivity = {
  id: string;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  actorName: string;
  createdAt: string;
};

export type DrawerAttachment = {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  uploaderName: string;
  createdAt: string;
};

export type TaskDetail = {
  task: TaskDTO;
  parent: { id: string; title: string } | null;
  subtasks: TaskNode[];
  blockedBy: { id: string; title: string; status: string }[];
  blocking: { id: string; title: string; status: string }[];
  comments: DrawerComment[];
  activity: DrawerActivity[];
  attachments: DrawerAttachment[];
  candidates: { id: string; title: string }[];
  meta: ProjectMeta;
};
