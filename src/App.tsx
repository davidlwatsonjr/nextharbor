import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Anchor, Archive, CalendarDays, Check, ChevronRight, CircleCheck, Clock3, Download, Ellipsis,
  Folder, Inbox, Layers3, ListChecks, Menu, Plus, RotateCcw, Settings2, Sparkles, Trash2, Upload, X, Zap,
} from 'lucide-react';
import { Editor } from './Editor';
import {
  archiveItem, blank, capture, finishReview, lists, parseBackup, putItem, restoreItem, reviewSteps, stalled,
  type Item, type List, type Workspace,
} from './gtd';
import { changes, load, update } from './storage';

type View = List | 'review' | 'settings';
const labels = { ...lists, review: 'Weekly Review', settings: 'Data & backups' };
const icons = {
  inbox: Inbox, next: Zap, projects: Folder, waiting: Clock3, calendar: CalendarDays,
  someday: Sparkles, reference: Archive, completed: CircleCheck, trash: Trash2, review: ListChecks, settings: Settings2,
};
const descriptions: Record<View, string> = {
  inbox: 'Capture whatever has your attention. Decide what it means when you clarify.',
  next: 'Choose a concrete action based on where you are, the time you have, and your energy.',
  projects: 'Track outcomes that need more than one action to complete.',
  waiting: 'Keep track of work you’ve delegated and replies you’re waiting for.',
  calendar: 'Reserve this list for actions and commitments that belong on a specific date.',
  someday: 'Keep ideas you may want to act on when the time is right.',
  reference: 'Keep useful information with no action attached.',
  completed: 'Look back at work you’ve finished.',
  trash: 'Restore anything you discarded by mistake.',
  review: 'Go through your lists, follow up on open commitments, and make sure every project can move forward.',
  settings: 'Move your workspace between browsers or keep a copy of your work.',
};
const groups: { title: string; views: View[] }[] = [
  { title: 'Workflow', views: ['inbox', 'next', 'projects', 'waiting', 'calendar'] },
  { title: 'Lists', views: ['someday', 'reference', 'completed', 'trash'] },
  { title: 'Review', views: ['review'] },
];
const localDate = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
});

export function App() {
  const [workspace, setWorkspace] = useState(blank);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('inbox');
  const [entry, setEntry] = useState('');
  const [editor, setEditor] = useState<Item>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [menu, setMenu] = useState(false);
  const [context, setContext] = useState('');
  const [time, setTime] = useState('');
  const [energy, setEnergy] = useState('');
  const [pendingBackup, setPendingBackup] = useState<Workspace>();
  const captureInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function refresh() {
      try {
        setWorkspace(await load());
        setReady(true);
      } catch {
        setError('This browser could not open local storage. Check your browser settings and reload.');
      }
    }
    void refresh();
    changes.addEventListener('message', refresh);
    return () => changes.removeEventListener('message', refresh);
  }, []);

  function navigate(next: View) {
    setView(next);
    setMenu(false);
    setStatus('');
    window.scrollTo(0, 0);
  }

  async function apply(change: (previous: Workspace) => Workspace, message: string) {
    setError('');
    try {
      setWorkspace(await update(change));
      setStatus(message);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your change could not be saved.');
      return false;
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!entry.trim()) return;
    const value = entry;
    if (await apply(previous => putItem(previous, capture(value)), 'Captured in Inbox.')) {
      setEntry(current => current === value ? '' : current);
    }
  }

  const tally = (list: List) => workspace.items.filter(item => item.list === list).length;
  const projects = workspace.items.filter(item => item.list === 'projects' || item.previous === 'projects');
  const stalledIds = new Set(stalled(workspace).map(project => project.id));
  const contexts = [...new Set(workspace.items.filter(item => item.list === 'next' && item.context).map(item => item.context))].sort();
  const visible = workspace.items.filter(item => item.list === view && (view !== 'next' ||
    ((!context || item.context === context) && (!time || (item.minutes > 0 && item.minutes <= Number(time))) &&
    (!energy || item.energy === energy))));
  if (view === 'calendar') visible.sort((a, b) => a.date.localeCompare(b.date));
  const active = icons[view];
  const ActiveIcon = active;
  const lastReview = workspace.lastReview ? new Date(workspace.lastReview).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : '';

  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nextharbor-backup.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="layout">
      {menu && <button className="overlay" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
      <aside className={'sidebar' + (menu ? ' expanded' : '')}>
        <button className="brand" onClick={() => navigate('inbox')}>
          <span className="brand-icon"><Anchor size={23}/></span>
          <span><strong>NextHarbor</strong><small>Personal workspace</small></span>
        </button>
        <nav aria-label="Workspace">
          {groups.map(group => <section key={group.title}><h2>{group.title}</h2>
            {group.views.map(key => {
              const Icon = icons[key];
              const count = key === 'inbox' || key === 'next' || key === 'projects' || key === 'waiting' ? tally(key) : 0;
              return <button key={key} className={view === key ? 'selected' : ''} aria-current={view === key ? 'page' : undefined}
                onClick={() => navigate(key)}><Icon size={17}/><span>{labels[key]}</span>{count > 0 && <small>{count}</small>}</button>;
            })}
          </section>)}
        </nav>
        <button className={'backup-nav ' + (view === 'settings' ? 'selected' : '')} onClick={() => navigate('settings')}
          aria-current={view === 'settings' ? 'page' : undefined}><Settings2 size={17}/> Data &amp; backups</button>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" aria-expanded={menu} onClick={() => setMenu(true)}><Menu size={24}/></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><strong>{labels[view]}</strong></div>
          <span className="local"><i/> Stored on this device</span>
          <button className="primary capture-button" disabled={!ready} onClick={() => {
            if (view === 'inbox') captureInput.current?.focus();
            else {
              navigate('inbox');
              requestAnimationFrame(() => captureInput.current?.focus());
            }
          }}><Plus size={18}/> Capture</button>
        </header>

        <div className="content">
          <header className="page-heading">
            <div><p className="eyebrow"><ActiveIcon size={15}/> {groups.find(group => group.views.includes(view))?.title ?? 'Workspace'}</p>
              <h1>{labels[view]}</h1><p>{descriptions[view]}</p></div>
            {ready && !['inbox', 'review', 'settings', 'trash', 'completed'].includes(view) &&
              <button className="primary" onClick={() => setEditor({ ...capture(''), list: view as List })}><Plus size={18}/> Add {view === 'projects' ? 'project' : 'item'}</button>}
          </header>

          {error && !editor && <div className="notice error" role="alert">{error}<button type="button" className="icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
          <div className="sr-only" role="status">{status}</div>
          {!ready && <p>{error ? 'Workspace unavailable.' : 'Opening your workspace…'}</p>}

          {ready && view === 'inbox' && <form className="capture-panel" onSubmit={add}>
            <label htmlFor="capture-input"><Plus size={18}/> Quick capture</label>
            <div className="capture-fields">
              <input id="capture-input" ref={captureInput} required maxLength={200} value={entry} onChange={event => setEntry(event.target.value)} placeholder="What’s on your mind?" />
              <button className="primary" type="submit">Add to inbox</button>
            </div>
          </form>}

          {ready && view === 'next' && <div className="filters">
            <label>Context<select value={context} onChange={event => setContext(event.target.value)}><option value="">All contexts</option>
              {context && !contexts.includes(context) && <option>{context}</option>}{contexts.map(value => <option key={value}>{value}</option>)}
            </select></label>
            <label>Time available<select value={time} onChange={event => setTime(event.target.value)}><option value="">Any time</option>
              {[5, 15, 30, 60, 120].map(value => <option key={value} value={value}>{value} min or less</option>)}</select></label>
            <label>Energy<select value={energy} onChange={event => setEnergy(event.target.value)}><option value="">Any energy</option><option>Low</option><option>Medium</option><option>High</option></select></label>
          </div>}

          {ready && view !== 'review' && view !== 'settings' && <div className={view === 'inbox' ? 'board' : ''}>
            <section className="panel" aria-label={labels[view]}>
              <div className="panel-header"><h2>{view === 'inbox' ? 'Unprocessed items' : labels[view]}</h2>
                <span className="count">{visible.length} {visible.length === 1 ? 'item' : 'items'}</span></div>
              {visible.length === 0 ? <div className="empty">
                <span className="empty-icon"><ActiveIcon size={29}/></span>
                <h3>{view === 'inbox' ? 'Your inbox is clear' : 'No items to show'}</h3>
                <p>{view === 'inbox' ? 'Add a thought, idea, or commitment above to get started.' :
                  view === 'next' && (context || time || energy) ? 'Try changing your filters.' : descriptions[view]}</p>
              </div> : <ul className="items">
                {visible.map(item => {
                  const archived = view === 'trash' || view === 'completed';
                  const canFinish = ['next', 'projects', 'waiting', 'calendar'].includes(view);
                  const project = projects.find(candidate => candidate.id === item.project);
                  return <li key={item.id}>
                    {canFinish && <button className="check-button" aria-label={'Complete ' + item.title}
                      onClick={() => void apply(previous => archiveItem(previous, item.id, 'completed'), 'Marked complete.')}><Check size={15}/></button>}
                    <div className="item-body">
                      {archived ? <strong>{item.title}</strong> : <button className="item-title" onClick={() => setEditor(item)}>{item.title}</button>}
                      {item.notes && <p>{item.notes}</p>}
                      <div className="item-meta">
                        {project && <span><Folder size={13}/>{project.title}</span>}
                        {view === 'next' && item.context && <span>{item.context}</span>}
                        {view === 'next' && item.minutes > 0 && <span>{item.minutes} min</span>}
                        {view === 'next' && item.energy && <span>{item.energy} energy</span>}
                        {view === 'waiting' && <span>{item.person}</span>}
                        {view === 'calendar' && <span>{localDate(item.date)}</span>}
                        {view === 'projects' && (stalledIds.has(item.id) ? <span className="attention">Needs a next action</span> :
                          <span>{workspace.items.filter(other => other.project === item.id && ['next', 'waiting', 'calendar'].includes(other.list)).length} open</span>)}
                        {archived && item.previous && <span>{lists[item.previous]}</span>}
                      </div>
                    </div>
                    {archived ? <button className="secondary" onClick={() => void apply(previous => restoreItem(previous, item.id), 'Item restored.')}>
                      <RotateCcw size={15}/> Restore</button> : <button className={view === 'inbox' ? 'secondary' : 'icon-button'}
                      aria-label={(view === 'inbox' ? 'Clarify ' : 'Edit ') + item.title} onClick={() => setEditor(item)}>
                      {view === 'inbox' ? 'Clarify' : <Ellipsis size={20}/>}
                    </button>}
                  </li>;
                })}
              </ul>}
            </section>
            {view === 'inbox' && <aside className="side-cards">
              <section className="review-card">
                <div className="review-icon"><ListChecks size={21}/></div>
                <h2>Weekly Review</h2>
                <p>{lastReview ? 'Last completed ' + lastReview : 'Set aside time to clear your inbox, check your lists, and get projects moving.'}</p>
                <button onClick={() => navigate('review')}>{workspace.review.length ? 'Continue review' : 'Open review'}</button>
              </section>
              <section className="panel overview">
                <h2><Layers3 size={17}/> Workspace at a glance</h2>
                {(['next', 'projects', 'waiting'] as const).map(key => <button key={key} onClick={() => navigate(key)}>
                  <span>{lists[key]}</span><strong>{tally(key)}</strong><ChevronRight size={14}/>
                </button>)}
              </section>
            </aside>}
          </div>}

          {ready && view === 'review' && <section className="panel review-panel">
            <div className="panel-header"><h2>Your review checklist</h2><span className="count">{new Set(workspace.review).size} of {reviewSteps.length} done</span></div>
            {lastReview && <p className="review-last">Last completed {lastReview}</p>}
            <ul className="items review-list">
              {reviewSteps.map(step => <li key={step.id}>
                <input type="checkbox" id={'review-' + step.id} checked={workspace.review.includes(step.id)}
                  onChange={event => {
                    const checked = event.target.checked;
                    void apply(previous => ({
                      ...previous,
                      review: checked ? [...new Set([...previous.review, step.id])] : previous.review.filter(id => id !== step.id),
                    }), 'Review progress saved.');
                  }}/>
                <label className="item-body" htmlFor={'review-' + step.id}><strong>{step.title}</strong><p>{step.detail}</p></label>
                <button className="secondary" onClick={() => navigate(step.list)}>Open {lists[step.list]}</button>
              </li>)}
            </ul>
            <div className="review-footer"><button className="primary" disabled={!reviewSteps.every(step => workspace.review.includes(step.id))}
              onClick={() => void apply(previous => finishReview(previous), 'Weekly review completed.')}>Finish review</button></div>
          </section>}

          {ready && view === 'settings' && <section className="panel settings">
            <h2>JSON backup</h2>
            <p>Your data lives in this browser. Export a backup before clearing site data or switching browsers. An import replaces the current workspace.</p>
            <div className="settings-actions">
              <button className="primary" onClick={exportBackup}><Download size={17}/> Export backup</button>
              <label className="secondary file-button"><Upload size={17}/> Choose backup
                <input type="file" accept=".json,application/json" onChange={async event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setError('');
                  setPendingBackup(undefined);
                  try {
                    setPendingBackup(parseBackup(JSON.parse(await file.text())));
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : 'The backup could not be read.');
                  }
                }}/>
              </label>
            </div>
            {pendingBackup && <div className="notice"><p>Replace this workspace with the backup containing {pendingBackup.items.length} items?</p>
              <button className="secondary" onClick={() => setPendingBackup(undefined)}>Cancel</button>
              <button className="primary" onClick={async () => {
                if (await apply(() => pendingBackup, 'Backup imported.')) setPendingBackup(undefined);
              }}>Replace workspace</button></div>}
            {status === 'Backup imported.' && <p>{status}</p>}
          </section>}
          <footer className="page-footer">Built around the Getting Things Done workflow.</footer>
        </div>
      </main>
      {editor && <Editor key={editor.id} item={editor} projects={projects.filter(item => item.list === 'projects' || item.id === editor.project)}
        error={error} onClose={() => { setEditor(undefined); setError(''); }}
        onSave={(item, action) => apply(previous => putItem(previous, item, action), 'Item saved.')}
        onArchive={workspace.items.some(item => item.id === editor.id) ? (destination, edits) =>
          apply(previous => archiveItem(edits ? putItem(previous, edits) : previous, editor.id, destination), destination === 'trash' ? 'Moved to Trash.' : 'Marked complete.') : undefined}/>}
    </div>
  );
}
