/**
 * Sparkline — SVG area chart for trend data.
 * Uses react-native-svg for lightweight inline charts.
 */

import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Polygon,
  Polyline,
  Circle,
  Line,
} from "react-native-svg";
import { Colors } from "../theme";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
  fillOpacity?: number;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = Colors.gold,
  showDot = true,
  fillOpacity = 0.15,
}: SparklineProps) {
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  // Empty or single-point: dashed horizontal line
  if (!data || data.length < 2) {
    const midY = height / 2;
    return (
      <Svg width={width} height={height}>
        <Line
          x1={pad}
          y1={midY}
          x2={width - pad}
          y2={midY}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={0.4}
        />
      </Svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Map data to SVG coordinates
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return { x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Polygon: line path + close along bottom
  const fillPoints =
    `${pad},${pad + h} ` +
    points.map((p) => `${p.x},${p.y}`).join(" ") +
    ` ${width - pad},${pad + h}`;

  const last = points[points.length - 1];
  const gradId = `sparkGrad_${width}_${height}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Polygon
        points={fillPoints}
        fill={`url(#${gradId})`}
        opacity={fillOpacity / 0.15}
      />
      <Polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <Circle cx={last.x} cy={last.y} r={2} fill={color} />
      )}
    </Svg>
  );
}
