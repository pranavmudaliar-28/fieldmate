import type { TaskDetail } from '@fieldmate/shared';
import { applyLocally } from './optimistic';

const WORKER = { id: 'w1', name: 'Priya Nair' };

const task = (overrides: Partial<TaskDetail> = {}): TaskDetail =>
  ({
    id: 't1',
    title: 'Replace water meter',
    description: 'Old meter leaking.',
    status: 'ASSIGNED',
    location: { address: '14 Harbour Rd', addressDetails: null, latitude: null, longitude: null },
    assignment: { worker: WORKER, assignedAt: '2026-01-01T09:00:00.000Z', rejection: null },
    progress: { acceptedAt: null, departedAt: null, arrivedAt: null, startedAt: null },
    review: { submittedAt: null, reviewedAt: null, reviewedBy: null, note: null },
    evidence: [],
    notes: [],
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    completedAt: null,
    ...overrides,
  }) as TaskDetail;

describe('showing a queued write before it is sent', () => {
  it('moves the status the way the server would', () => {
    // The same transition table the API enforces, so the two cannot disagree.
    expect(applyLocally(task(), { kind: 'step', step: 'accept' }, WORKER).status).toBe('ACCEPTED');
    expect(
      applyLocally(task({ status: 'REACHED_LOCATION' }), { kind: 'step', step: 'start' }, WORKER)
        .status,
    ).toBe('IN_PROGRESS');
  });

  it('walks a step back', () => {
    expect(applyLocally(task({ status: 'ACCEPTED' }), { kind: 'stepBack' }, WORKER).status).toBe(
      'ASSIGNED',
    );
  });

  it('sends finished work for review, never straight to completed', () => {
    const after = applyLocally(task({ status: 'IN_PROGRESS' }), { kind: 'complete' }, WORKER);

    expect(after.status).toBe('AWAITING_REVIEW');
    expect(after.completedAt).toBeNull();
    expect(after.review.submittedAt).not.toBeNull();
  });

  it('adds a note the worker can see straight away', () => {
    const after = applyLocally(
      task({ status: 'IN_PROGRESS' }),
      { kind: 'note.add', content: 'Meter replaced.' },
      WORKER,
    );

    expect(after.notes).toHaveLength(1);
    expect(after.notes[0]).toMatchObject({ content: 'Meter replaced.', createdBy: WORKER });
    expect(after.notes[0]?.updatedAt).toBeNull();
  });

  it('edits and deletes a note in place', () => {
    const withNote = applyLocally(
      task({ status: 'IN_PROGRESS' }),
      { kind: 'note.add', content: 'Meter replced.' },
      WORKER,
    );
    const noteId = withNote.notes[0]!.id;

    const edited = applyLocally(
      withNote,
      { kind: 'note.edit', noteId, content: 'Meter replaced.' },
      WORKER,
    );
    expect(edited.notes[0]?.content).toBe('Meter replaced.');
    expect(edited.notes[0]?.updatedAt).not.toBeNull();

    const deleted = applyLocally(edited, { kind: 'note.delete', noteId }, WORKER);
    expect(deleted.notes).toHaveLength(0);
  });

  it('shows the photo from the phone, since there is no link to it yet', () => {
    const after = applyLocally(
      task({ status: 'IN_PROGRESS' }),
      {
        kind: 'photo',
        photoId: 'photo-1',
        localUri: 'file:///offline/photos/photo-1',
        mimeType: 'image/jpeg',
        size: 1024,
        source: 'CAMERA',
      },
      WORKER,
    );

    expect(after.evidence).toHaveLength(1);
    expect(after.evidence[0]).toMatchObject({
      url: 'file:///offline/photos/photo-1',
      source: 'CAMERA',
      uploadedBy: WORKER,
    });
  });

  it('leaves the task alone when the step leads nowhere', () => {
    // Stepping back from ASSIGNED is not a move the lifecycle allows.
    const before = task({ status: 'ASSIGNED' });
    expect(applyLocally(before, { kind: 'stepBack' }, WORKER)).toBe(before);
  });
});
