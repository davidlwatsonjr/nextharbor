import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { lists, type Destination, type Energy, type Item } from './gtd';

const routes = [
  { list: 'next', hint: 'A concrete action you can do' },
  { list: 'projects', hint: 'An outcome that takes multiple actions' },
  { list: 'waiting', hint: 'Something someone else owes you' },
  { list: 'calendar', hint: 'An action that must happen on a date' },
  { list: 'someday', hint: 'An idea you might act on later' },
  { list: 'reference', hint: 'Information worth keeping' },
] as const;

export function Editor({ item, projects, error, onClose, onSave, onArchive }: {
  item: Item;
  projects: Item[];
  error: string;
  onClose: () => void;
  onSave: (item: Item, action: string) => Promise<boolean>;
  onArchive?: (destination: 'completed' | 'trash', edits?: Item) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(item);
  const [action, setAction] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const clarification = item.list === 'inbox' && Boolean(onArchive);
  const movingProject = item.list === 'projects' && Boolean(onArchive);

  useEffect(() => { dialog.current?.showModal(); }, []);

  function change<K extends keyof Item>(field: K, value: Item[K]) {
    setDraft(current => ({ ...current, [field]: value }));
  }

  async function run(save: () => Promise<boolean>) {
    setSaving(true);
    try {
      if (await save()) onClose();
    } finally {
      setSaving(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const updated = { ...draft, project: draft.list === 'projects' || draft.list === 'inbox' ? '' : draft.project };
    void run(() => onSave(updated, action));
  }

  return (
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} aria-labelledby="editor-title">
      <form onSubmit={save} className="editor">
        <header className="editor-head">
          <div><p className="eyebrow">{clarification ? 'Inbox' : lists[item.list]}</p>
            <h2 id="editor-title">{clarification ? 'Clarify item' : onArchive ? 'Edit item' : 'Add item'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close editor" onClick={onClose} disabled={saving}><X size={21}/></button>
        </header>
        {clarification && <>
          <p className="helper">Is it actionable? If you can finish it in two minutes, do it now. Otherwise decide where it belongs.</p>
          <fieldset className="routes"><legend>Where does it belong?</legend>
            {routes.map(({ list, hint }) => <label className="route" key={list}>
              <input type="radio" name="route" value={list} checked={draft.list === list} onChange={() => change('list', list)} required/>
              <span><strong>{lists[list]}</strong><small>{hint}</small></span>
            </label>)}
          </fieldset>
        </>}
        {!clarification && onArchive && !movingProject && <label>List<select value={draft.list} onChange={event => change('list', event.target.value as Destination)}>
          <option value="inbox">Inbox</option>
          {routes.filter(route => route.list !== 'projects').map(({ list }) => <option key={list} value={list}>{lists[list]}</option>)}
        </select></label>}
        <label>{draft.list === 'projects' ? 'Desired outcome' : 'Title'}
          <input required maxLength={200} value={draft.title} onChange={event => change('title', event.target.value)}
            placeholder={draft.list === 'projects' ? 'e.g. Publish the team onboarding guide' : 'What needs your attention?'} autoFocus />
        </label>
        {draft.list === 'projects' && <label>{movingProject ? 'Add a next action' : 'First next action'} <span className="optional">optional</span>
          <input maxLength={200} value={action} onChange={event => setAction(event.target.value)} placeholder="e.g. Ask the team for feedback on the draft"/>
        </label>}
        {draft.list !== 'projects' && draft.list !== 'inbox' && (projects.length > 0 || draft.project) && <label>Project <span className="optional">optional</span>
          <select value={draft.project} onChange={event => change('project', event.target.value)}>
            <option value="">No project</option>
            {projects.map(project => <option key={project.id} value={project.id}>{project.title}{project.list !== 'projects' ? ' (archived)' : ''}</option>)}
          </select></label>}
        {draft.list === 'next' && <div className="fields">
          <label>Context<input maxLength={80} value={draft.context} onChange={event => change('context', event.target.value)} placeholder="@computer" /></label>
          <label>Minutes<input type="number" min="1" max="10080" value={draft.minutes || ''} onChange={event => change('minutes', Number(event.target.value))} placeholder="Any" /></label>
          <label>Energy<select value={draft.energy} onChange={event => change('energy', event.target.value as Energy)}>
            <option value="">Any</option><option>Low</option><option>Medium</option><option>High</option>
          </select></label>
        </div>}
        {draft.list === 'waiting' && <label>Who are you waiting for?<input required maxLength={100} value={draft.person} onChange={event => change('person', event.target.value)} /></label>}
        {draft.list === 'calendar' && <label>Date this must happen<input type="date" required value={draft.date} onChange={event => change('date', event.target.value)} /></label>}
        <label>Notes <span className="optional">optional</span><textarea rows={3} value={draft.notes} onChange={event => change('notes', event.target.value)}/></label>
        {error && <p className="notice error" role="alert">{error}</p>}
        <footer className="editor-footer">
          {onArchive && <button type="button" className="text-button danger" disabled={saving} onClick={() => run(() => onArchive('trash'))}>{clarification ? 'Trash' : 'Move to Trash'}</button>}
          {clarification && onArchive && <button type="button" className="secondary" disabled={saving} onClick={() => run(() => onArchive('completed', { ...draft, list: 'inbox', project: '' }))}>Done now</button>}
          <button type="submit" className="primary" disabled={saving}>{clarification ? 'File item' : 'Save item'}</button>
        </footer>
      </form>
    </dialog>
  );
}
