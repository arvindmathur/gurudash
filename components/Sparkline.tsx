interface SparklineProps {
  data: number[];
}

export function Sparkline({ data }: SparklineProps) {
  return (
    <svg width="56" height="16" className="inline-block">
      {data.map((value, i) => {
        const barHeight = value > 0 ? 12 : 4;
        const color = value > 0 ? '#ef4444' : '#374151';
        const y = 16 - barHeight;
        return (
          <rect
            key={i}
            x={i * 8}
            y={y}
            width="4"
            height={barHeight}
            fill={color}
          />
        );
      })}
    </svg>
  );
}
