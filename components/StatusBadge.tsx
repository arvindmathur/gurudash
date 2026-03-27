interface StatusBadgeProps {
  status: 'ok' | 'error' | 'warning' | 'stale' | 'skipped' | 'unknown' | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    ok: 'text-green-400 bg-green-400/10',
    error: 'text-red-400 bg-red-400/10',
    warning: 'text-yellow-400 bg-yellow-400/10',
    stale: 'text-orange-400 bg-orange-400/10',
    skipped: 'text-gray-400 bg-gray-400/10',
    unknown: 'text-gray-400 bg-gray-400/10',
  };

  const style = styles[status as keyof typeof styles] || styles.unknown;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
