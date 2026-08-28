import { useEffect } from 'react';
import { CheckCircle2, Clock3, RefreshCw, TriangleAlert } from 'lucide-react';
import { api, type OtpDelivery } from '../lib/api';

// Once the provider has handed the message to the mobile network, further
// delivery polling does not help the caller enter the code and only spends API
// capacity. Verification still refreshes the provider state before accepting it.
const TERMINAL_STATES = new Set(['sent', 'delivered', 'failed', 'canceled', 'bypassed']);

const STATUS_COPY = {
  queued: 'Your code is queued for secure delivery.',
  sent: 'Your code was sent to the mobile network.',
  delivered: 'Your code was delivered.',
  failed: 'This code could not be delivered. Request a new code.',
  canceled: 'This code was replaced or cancelled. Request a new code.',
  bypassed: 'Phone verification is complete in this test environment.'
} as const;

export default function OtpDeliveryStatus({
  delivery,
  onDeliveryChange,
  onResend,
  busy = false
}: {
  delivery: OtpDelivery | null;
  onDeliveryChange: (delivery: OtpDelivery) => void;
  onResend: () => void;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!delivery || TERMINAL_STATES.has(delivery.delivery_status)) return;
    let active = true;
    const poll = async () => {
      try {
        const next = await api.getOtpStatus(delivery.challenge_id);
        if (active) onDeliveryChange(next);
      } catch {
        // A transient status error does not invalidate the code. The next poll
        // retries without exposing provider or recipient information.
      }
    };
    const timer = window.setInterval(() => void poll(), 2_500);
    void poll();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [delivery?.challenge_id, delivery?.delivery_status, onDeliveryChange]);

  if (!delivery) return null;
  const failed = delivery.delivery_status === 'failed' || delivery.delivery_status === 'canceled';
  const complete = delivery.delivery_status === 'delivered' || delivery.delivery_status === 'bypassed';
  const Icon = failed ? TriangleAlert : complete ? CheckCircle2 : delivery.delivery_status === 'sent' ? CheckCircle2 : Clock3;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
        failed ? 'border-red-200 bg-red-50 text-red-800'
          : complete ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-sky-200 bg-sky-50 text-sky-900'
      }`}
    >
      <span className="flex min-w-0 items-start gap-3 font-semibold">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span>{STATUS_COPY[delivery.delivery_status]}</span>
      </span>
      {failed && (
        <button
          type="button"
          disabled={busy}
          onClick={onResend}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Request new code
        </button>
      )}
    </div>
  );
}
