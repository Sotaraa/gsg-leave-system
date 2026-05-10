import React, { useState, useCallback } from 'react';
import { ShieldAlert, X, Trash2 } from 'lucide-react';

/**
 * Reusable destructive-action confirmation hook.
 *
 * Two modes:
 *   - Simple        – user clicks Confirm to proceed
 *   - Typed-phrase  – user must type a specific phrase (e.g. "DELETE 47") first
 *
 * Usage:
 *   const { ask, modal } = useConfirm();
 *
 *   const onDeleteThing = (thing) =>
 *     ask({
 *       title: 'Delete department',
 *       message: `This will remove "${thing.name}" from the dropdown.`,
 *       warningPoints: ['Existing staff in this dept will keep their assignment.'],
 *       confirmLabel: 'Delete',
 *       requirePhrase: `DELETE ${thing.name}`,   // optional — typed-phrase mode
 *       onConfirm: () => actuallyDelete(thing.id),
 *     });
 *
 *   return (<>
 *     ...your UI...
 *     {modal}
 *   </>);
 *
 * The hook returns a single modal — only one confirmation can be open at a time.
 * Calling ask() again replaces the current state.
 */
export const useConfirm = () => {
  const [state, setState] = useState(null);
  const [text, setText]   = useState('');
  const [busy, setBusy]   = useState(false);

  const close = useCallback(() => {
    if (busy) return;
    setState(null);
    setText('');
  }, [busy]);

  const ask = useCallback((opts) => {
    setText('');
    setState({
      title:         opts.title         || 'Are you sure?',
      message:       opts.message       || '',
      warningPoints: opts.warningPoints || [],
      confirmLabel:  opts.confirmLabel  || 'Confirm',
      requirePhrase: opts.requirePhrase || null,
      onConfirm:     opts.onConfirm     || (() => {}),
    });
  }, []);

  const armed = !state?.requirePhrase || text.trim() === state.requirePhrase;

  const handleConfirm = useCallback(async () => {
    if (!state || !armed) return;
    setBusy(true);
    try {
      await state.onConfirm();
    } catch (err) {
      console.error('Confirmed action failed:', err);
    } finally {
      setBusy(false);
      setState(null);
      setText('');
    }
  }, [state, armed]);

  const modal = state ? (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.55)' }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} />
            <h3 id="confirm-modal-title" className="font-bold text-sm">{state.title}</h3>
          </div>
          <button
            onClick={close}
            disabled={busy}
            className="text-white/80 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {state.message && (
            <p className="text-sm text-gray-800">{state.message}</p>
          )}

          {state.warningPoints.length > 0 && (
            <ul className="text-xs text-gray-600 list-disc pl-5 space-y-1">
              {state.warningPoints.map((p, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: p }} />
              ))}
            </ul>
          )}

          {state.requirePhrase && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 mb-2">
                To confirm, type the following phrase exactly:
              </p>
              <code className="block bg-white border border-amber-300 rounded px-3 py-2 text-sm font-mono text-amber-900 mb-2 select-all break-all">
                {state.requirePhrase}
              </code>
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type the phrase here"
                autoFocus
                disabled={busy}
                className={`w-full px-3 py-2 text-sm border rounded font-mono focus:outline-none focus:ring-2 ${
                  armed
                    ? 'border-red-400 focus:ring-red-300 bg-red-50'
                    : 'border-gray-300 focus:ring-amber-300'
                }`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 flex items-center justify-end gap-2 border-t border-gray-200">
          <button
            onClick={close}
            disabled={busy}
            className="btn btn-secondary text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!armed || busy}
            className={`btn text-xs flex items-center gap-1.5 ${
              armed && !busy
                ? 'bg-red-600 text-white hover:bg-red-700 border-red-600'
                : 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <Trash2 size={13}/>
            {busy ? 'Working…' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, modal };
};
