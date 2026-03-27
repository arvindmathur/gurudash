interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

export function RefreshButton({ onRefresh, isLoading }: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      className="bg-transparent text-gray-500 hover:text-gray-300 transition-colors"
      aria-label="Refresh"
    >
      <span className={isLoading ? 'inline-block animate-spin' : ''}>↻</span>
    </button>
  );
}
