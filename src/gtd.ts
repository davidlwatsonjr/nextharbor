export const lists = {
  inbox: 'Inbox',
  next: 'Next Actions',
  projects: 'Projects',
  waiting: 'Waiting For',
  calendar: 'Calendar',
  someday: 'Someday / Maybe',
  reference: 'Reference',
  completed: 'Completed',
  trash: 'Trash',
} as const;
export type List = keyof typeof lists;
export type Destination = Exclude<List, 'completed' | 'trash'>;
export type Energy = '' | 'Low' | 'Medium' | 'High';

export interface Item {
  id: string;
  title: string;
  notes: string;
  list: List;
  previous?: Destination;
  project: string;
  context: string;
  minutes: number;
  energy: Energy;
  person: string;
  date: string;
}

export interface Workspace {
  version: 1;
  items: Item[];
  review: string[];
  lastReview: string;
}

export const blank = (): Workspace => ({ version: 1, items: [], review: [], lastReview: '' });

export const reviewSteps = [
  { id: 'collect', title: 'Collect loose ends', detail: 'Gather notes and add anything still on your mind to the inbox.', list: 'inbox' },
  { id: 'clarify', title: 'Clear the inbox', detail: 'Decide what each item means and put it on the appropriate list.', list: 'inbox' },
  { id: 'actions', title: 'Review next actions', detail: 'Mark finished actions and check that each remaining action is ready to do.', list: 'next' },
  { id: 'calendar', title: 'Look back and ahead', detail: 'Check your recent and upcoming calendar for actions you need to capture.', list: 'calendar' },
  { id: 'waiting', title: 'Follow up on delegated work', detail: 'Check what others owe you and decide whether to follow up.', list: 'waiting' },
  { id: 'projects', title: 'Review project outcomes', detail: 'Give each active outcome a next action or a calendar or waiting reminder.', list: 'projects' },
  { id: 'someday', title: 'Revisit Someday / Maybe', detail: 'Activate ideas you can commit to and drop the ones you no longer want.', list: 'someday' },
] as const;

export function capture(title: string): Item {
  return {
    id: crypto.randomUUID(), title: title.trim(), notes: '', list: 'inbox',
    project: '', context: '', minutes: 0, energy: '', person: '', date: '',
  };
}

export function putItem(workspace: Workspace, item: Item, actionTitle = ''): Workspace {
  const normalized = { ...item, title: item.title.trim(), context: item.context.trim(), person: item.person.trim() };
  const existing = workspace.items.find(({ id }) => id === normalized.id);
  if (existing?.list === 'projects' && normalized.list !== 'projects') {
    throw new Error('Finish or trash the project from its list.');
  }
  validateItem(normalized);
  if (normalized.project && !workspace.items.some(
    ({ id, list, previous }) => id === normalized.project && (list === 'projects' || previous === 'projects'),
  )) throw new Error('Choose an existing project.');
  const items = existing
    ? workspace.items.map(current => current.id === normalized.id ? normalized : current)
    : [...workspace.items, normalized];
  if (actionTitle.trim() && normalized.list === 'projects') {
    items.push({ ...capture(actionTitle), list: 'next', project: normalized.id });
  }
  return { ...workspace, items };
}

export function archiveItem(workspace: Workspace, id: string, destination: 'completed' | 'trash'): Workspace {
  if (workspace.items.some(item => item.id === id && item.list === 'projects') &&
    workspace.items.some(item => item.project === id && ['next', 'waiting', 'calendar', 'someday'].includes(item.list))) {
    throw new Error('Finish or reassign the project’s open items first.');
  }
  return {
    ...workspace,
    items: workspace.items.map(item => item.id === id ? {
      ...item, list: destination,
      previous: item.list === 'completed' || item.list === 'trash' ? item.previous : item.list,
    } : item),
  };
}

export function restoreItem(workspace: Workspace, id: string): Workspace {
  return {
    ...workspace,
    items: workspace.items.map(item => item.id === id && (item.list === 'completed' || item.list === 'trash')
      ? { ...item, list: item.previous ?? 'inbox', previous: undefined }
      : item),
  };
}

export function stalled(workspace: Workspace): Item[] {
  const covered = new Set(workspace.items
    .filter(item => ['next', 'waiting', 'calendar'].includes(item.list))
    .map(item => item.project));
  return workspace.items.filter(item => item.list === 'projects' && !covered.has(item.id));
}

export function finishReview(workspace: Workspace, now = new Date()): Workspace {
  if (!reviewSteps.every(step => workspace.review.includes(step.id))) throw new Error('Finish every review step first.');
  return { ...workspace, review: [], lastReview: now.toISOString() };
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validateItem(item: Item): void {
  if (!item || typeof item !== 'object' ||
    !['id', 'title', 'notes', 'project', 'context', 'person', 'date'].every(field =>
      typeof item[field as keyof Item] === 'string') ||
    !item.id.trim() || !item.title.trim() || !Object.hasOwn(lists, item.list) ||
    !['', 'Low', 'Medium', 'High'].includes(item.energy) ||
    !Number.isSafeInteger(item.minutes) || item.minutes < 0) throw new Error('An item has invalid fields.');
  const original = item.previous ?? item.list;
  if (item.previous && (!['trash', 'completed'].includes(item.list) ||
    !Object.hasOwn(lists, item.previous) || ['trash', 'completed'].includes(item.previous))) {
    throw new Error('An archived item has an invalid original list.');
  }
  if (original === 'waiting' && !item.person.trim()) throw new Error('Enter who you are waiting for.');
  if (original === 'calendar' && !validDate(item.date)) throw new Error('Choose the date this must happen.');
  if (original === 'projects' && item.project) throw new Error('Projects cannot belong to another project.');
}

export function parseBackup(data: unknown): Workspace {
  const value = data as Workspace;
  if (!value || value.version !== 1 || !Array.isArray(value.items) || !Array.isArray(value.review) ||
    typeof value.lastReview !== 'string' || (value.lastReview && !Number.isFinite(Date.parse(value.lastReview))) ||
    value.review.some(id => !reviewSteps.some(step => step.id === id))) {
    throw new Error('Choose a valid NextHarbor backup.');
  }
  const ids = new Set<string>();
  const projects = new Set<string>();
  for (const item of value.items) {
    validateItem(item);
    if (ids.has(item.id)) throw new Error('The backup contains duplicate items.');
    ids.add(item.id);
    if (item.list === 'projects' || item.previous === 'projects') projects.add(item.id);
  }
  if (value.items.some(item => item.project && !projects.has(item.project))) {
    throw new Error('The backup contains a missing project.');
  }
  return value;
}
