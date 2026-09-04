import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders dialogs outside the page stacking context and keeps the page behind
 * them still. The site header and decorative content both create their own
 * layers, so an in-page fixed element can otherwise appear underneath them.
 */
export default function ModalPortal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const background = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== host.current).map(node => ({ node, inert: node.inert }));
    background.forEach(({ node }) => { node.inert = true; });
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (host.current?.inert) return;
      if (event.key === 'Escape') onCloseRef.current?.();
      if (event.key === 'Tab') {
        const controls = Array.from(host.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(node => node.tabIndex >= 0 && node.getClientRects().length > 0 && !node.closest('[hidden]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !host.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      background.forEach(({ node, inert }) => { node.inert = inert; });
      returnFocus.current?.focus();
    };
  }, []);

  return createPortal(<div ref={host}>{children}</div>, document.body);
}
