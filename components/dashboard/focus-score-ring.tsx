import { cn } from "@/lib/utils"

interface FocusScoreRingProps {
  score: number // 0 to 100
  size?: number
}

export function FocusScoreRing({ score, size = 120 }: FocusScoreRingProps) {
  const strokeWidth = size * 0.1
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  
  // Color calculation based on score
  let colorClass = "text-emerald-500"
  if (score < 50) colorClass = "text-red-500"
  else if (score < 80) colorClass = "text-amber-500"

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-1000 ease-out", colorClass)}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-3xl tracking-tighter font-bold">{score}</span>
        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Score</span>
      </div>
    </div>
  )
}
