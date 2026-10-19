type DoodleKind = 'welcome' | 'search' | 'community';

export default function Doodle({ kind = 'welcome', className = '' }: { kind?: DoodleKind; className?: string }) {
  return <img src={`/images/doodles/drop-${kind}.webp`} alt="" width={160} height={160} decoding="async" className={`drop-doodle ${className}`} />;
}
