
import React from 'react';

interface MedianLabelProps {
  // Props injected by Recharts' LabelList or ReferenceDot
  x?: number;
  y?: number;
  viewBox?: { x: number; y: number };

  // Custom props
  text: string | null;
  dy?: number; // Vertical offset
  dx?: number; // Horizontal offset
}

export const MedianLabel: React.FC<MedianLabelProps> = (props) => {
  const { viewBox, text, dy = 0, dx = 0 } = props;
  
  // props.x and props.y are injected by LabelList, but not ReferenceDot
  // viewBox is injected by both
  const x = props.x ?? viewBox?.x ?? 0;
  const y = props.y ?? viewBox?.y ?? 0;

  if (viewBox === undefined || text === null || text === '') return null;

  // Estimate text width for dynamic background sizing.
  // This is an approximation but works well for monospace/consistent fonts.
  const estTextWidth = text.length * 6.5; 
  const rectWidth = estTextWidth + 16;
  const rectHeight = 24;
  const finalY = y + dy;
  const finalX = x + dx;

  return (
      <g transform={`translate(${finalX}, ${finalY})`} style={{ pointerEvents: 'none' }}>
          <defs>
            <filter id="label-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.3)" />
            </filter>
          </defs>
          <rect
              x={-rectWidth / 2}
              y={-rectHeight / 2}
              width={rectWidth}
              height={rectHeight}
              rx="8"
              ry="8"
              fill="rgba(250, 250, 250, 0.95)"
              filter="url(#label-shadow)"
          />
          <text
              x="0"
              y="1"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1a202c"
              fontSize="12px"
              fontWeight="bold"
          >
            {text}
          </text>
      </g>
  );
};
