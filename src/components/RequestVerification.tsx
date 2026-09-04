export default function RequestVerification({ state }: { state?: string }) {
  return state === 'UNVERIFIED' ? <span className="inline-flex items-center border-b-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-950">Unverified Request Post</span> : null;
}
