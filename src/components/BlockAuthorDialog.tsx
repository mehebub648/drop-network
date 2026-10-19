import ModalPortal from './ModalPortal';

export default function BlockAuthorDialog({ name, busy, onConfirm, onClose }: {
  name: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const close = () => { if (!busy) onClose(); };
  return <ModalPortal onClose={close}>
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) close();
    }}>
      <div className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="block-author-title" aria-describedby="block-author-description" aria-busy={busy}>
        <h2 id="block-author-title">Block {name}?</h2>
        <p id="block-author-description">Their comments and community posts will be hidden from your signed-in view.</p>
        <div className="dialog-actions">
          <button type="button" autoFocus disabled={busy} onClick={close} className="button button-secondary">Keep seeing this author</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="button button-danger">{busy ? 'Blocking…' : 'Block author'}</button>
        </div>
      </div>
    </div>
  </ModalPortal>;
}
