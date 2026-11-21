import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveItem, blank, capture, finishReview, parseBackup, putItem, restoreItem, reviewSteps, stalled } from './gtd.ts';

test('captures an item and clarifies it without creating a duplicate', () => {
  const item = capture('  Call school  ');
  const workspace = putItem(putItem(blank(), item), { ...item, list: 'next', context: ' @phone ' });
  assert.deepEqual(workspace.items.map(({ id, title, list, context }) => [id, title, list, context]),
    [[item.id, 'Call school', 'next', '@phone']]);
});

test('requires a person for Waiting For and a real date for Calendar', () => {
  const item = capture('Get feedback');
  assert.throws(() => putItem(blank(), { ...item, list: 'waiting' }), /who/);
  assert.throws(() => putItem(blank(), { ...item, list: 'calendar', date: '2026-02-30' }), /date/);
  assert.equal(putItem(blank(), { ...item, list: 'calendar', date: '2026-02-28' }).items.length, 1);
});

test('a project can start with a linked next action and stall when the action is complete', () => {
  const project = { ...capture('Launch the site'), list: 'projects' as const };
  let workspace = putItem(blank(), project, 'Write homepage copy');
  const action = workspace.items[1];
  assert.equal(action.project, project.id);
  assert.deepEqual(stalled(workspace), []);
  assert.throws(() => archiveItem(workspace, project.id, 'completed'), /open items/);
  workspace = archiveItem(workspace, action.id, 'completed');
  assert.deepEqual(stalled(workspace), [project]);
  assert.equal(restoreItem(workspace, action.id).items[1].list, 'next');
});

test('records a finished review and starts a fresh checklist', () => {
  assert.throws(() => finishReview(blank()), /every review step/);
  const date = new Date('2026-11-21T12:00:00Z');
  const result = finishReview({ ...blank(), review: reviewSteps.map(step => step.id) }, date);
  assert.deepEqual(result.review, []);
  assert.equal(result.lastReview, date.toISOString());
});

test('validates a backup before accepting it', () => {
  const item = capture('One thing');
  const workspace = putItem(blank(), item);
  assert.deepEqual(parseBackup(JSON.parse(JSON.stringify(workspace))), workspace);
  assert.throws(() => parseBackup({ ...workspace, items: [item, item] }), /duplicate/);
  assert.throws(() => parseBackup({ ...workspace, items: [{ ...item, project: 'missing' }] }), /missing project/);
  assert.throws(() => parseBackup({ ...workspace, items: [{ ...item, list: 'constructor' }] }), /invalid/);
});
