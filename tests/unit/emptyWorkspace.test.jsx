import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/*
 * The workspace empty state, tested where the state can actually be produced.
 *
 * It is unreachable through the UI: useDocuments seeds a default document
 * whenever the store loads empty, and deleting the last one reseeds too. The
 * component is a guard for the paths where that seeding cannot happen — a
 * blocked IndexedDB, or the beat before the seed resolves — so it is exercised
 * with the documents API stubbed rather than by trying to empty a real store.
 */

const api = vi.hoisted(() => ({ create: vi.fn(), open: vi.fn() }));

vi.mock('@/App/Container', () => ({
  useDocumentsApi: () => api,
}));

const { default: EmptyWorkspace } = await import(
  '@/App/Components/EmptyWorkspace.jsx'
);

beforeEach(() => {
  api.create.mockReset();
  api.open.mockReset();
});

describe('EmptyWorkspace', () => {
  it('explains what to do', () => {
    render(<EmptyWorkspace />);
    expect(
      screen.getByText('Create a new document to get started'),
    ).toBeTruthy();
  });

  it('offers a button that creates and activates a document', () => {
    api.create.mockReturnValue('new-id');
    render(<EmptyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /New Document/ }));

    expect(api.create).toHaveBeenCalledTimes(1);
    // create() alone would leave the user looking at the same empty screen.
    expect(api.open).toHaveBeenCalledWith('new-id');
  });

  it('does not try to activate a document that was not created', () => {
    // create() returns undefined when the store refuses the write.
    api.create.mockReturnValue(undefined);
    render(<EmptyWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: /New Document/ }));

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.open).not.toHaveBeenCalled();
  });
});
