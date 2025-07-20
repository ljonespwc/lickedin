'use client'

import { useEffect, useState } from 'react'

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
  label?: string
}

export function ProgressRing({ 
  progress, 
  size = 80, 
  strokeWidth = 6, 
  className = '',
  showValue = true,
  label
}: ProgressRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)
  
  const center = size / 2
  const radius = center - strokeWidth
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference
  
  // Determine color based on progress value
  const getColor = (value: number) => {
    if (value >= 80) return 'text-green-500'
    if (value >= 60) return 'text-yellow-500' 
    return 'text-red-500'
  }
  
  const getStrokeColor = (value: number) => {
    if (value >= 80) return '#22c55e' // green-500
    if (value >= 60) return '#eab308' // yellow-500
    return '#ef4444' // red-500
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress)
    }, 100)
    
    return () => clearTimeout(timer)
  }, [progress])

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg 
        width={size} 
        height={size} 
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={getStrokeColor(progress)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <span className={`text-lg font-bold ${getColor(progress)}`}>
            {progress > 0 ? `${Math.round(progress)}` : '--'}
          </span>
        )}
        {label && (
          <span className="text-xs text-muted-foreground text-center leading-tight mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}