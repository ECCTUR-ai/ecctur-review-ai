import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

export function StarRating({ rating, max = 5, size = 14 }: StarRatingProps) {
  return (
    <div className="flex gap-0.5 text-yellow-500">
      {Array.from({ length: max }).map((_, i) => (
        <Star 
          key={i} 
          size={size} 
          fill={i < rating ? 'currentColor' : 'none'} 
          className={i < rating ? 'text-yellow-500' : 'text-slate-600'}
        />
      ))}
    </div>
  );
}
