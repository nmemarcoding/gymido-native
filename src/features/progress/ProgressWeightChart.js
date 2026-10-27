import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { CAP_BODY } from '../../shared/components/largeText';
import { colors, typography } from '../../shared/theme/tokens';
import { buildWeightSeries, monotoneXPath, weightAxis } from '../trainer/clients/weightChartData';

// The v2 Progress weight chart (UX G "Progress" / "Tablet: Progress"):
// a gold 2.5 line over a gold area (gold-line 0.30 → 0), the end dot (r5,
// 2 px ground ring), a dashed baseline, and U9's dashed goal line from the
// existing goal weight. The axis always contains the goal (UX §9a ruling:
// the axis widens). First/last date labels below. One unit for the chart
// (T-38: the current unit). Drawn with an explicit Svg size (Android).
const PAD = 6;

export function chartGeometry(logs, unit, goal, width, height) {
  const series = buildWeightSeries(logs, null, unit);
  if (series.points.length < 2 || width <= 0) {
    return null;
  }
  const values = series.points.map((point) => point.value);
  const withGoal = goal === null || goal === undefined ? values : values.concat(goal);
  const axis = weightAxis(Math.min(...withGoal), Math.max(...withGoal));
  const y = (value) => PAD + ((axis.max - value) / (axis.max - axis.min || 1)) * (height - PAD * 2);
  const step = (width - PAD * 2) / (series.points.length - 1);
  const points = series.points.map((point, index) => [PAD + index * step, y(point.value)]);
  const line = monotoneXPath(points);
  const last = points[points.length - 1];
  const area = `${line}L${last[0]},${height}L${points[0][0]},${height}Z`;
  return {
    points,
    line,
    area,
    last,
    goalY: goal === null || goal === undefined ? null : y(goal),
    first: series.points[0].label,
    end: series.points[series.points.length - 1].label,
  };
}

export default function ProgressWeightChart({ logs, unit, goal, height = 110, grid = false, label, testID = 'progress-chart' }) {
  const [width, setWidth] = useState(0);
  const geo = chartGeometry(logs, unit, goal, width, height);
  return (
    <View testID={testID}>
      <View
        testID={`${testID}-plot`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{ height }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {geo ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="progressArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.gold} stopOpacity={0.3} />
                <Stop offset="1" stopColor={colors.gold} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {grid
              ? [0.25, 0.5, 0.75].map((ratio) => (
                  <Line key={ratio} x1={0} x2={width} y1={height * ratio} y2={height * ratio} stroke={colors.hairline} strokeWidth={1} strokeDasharray="4 4" />
                ))
              : null}
            <Line testID={`${testID}-baseline`} x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={colors.hairlineStrong} strokeWidth={1} strokeDasharray="4 4" />
            <Path d={geo.area} fill="url(#progressArea)" />
            <Path testID={`${testID}-line`} d={geo.line} fill="none" stroke={colors.gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            {geo.goalY !== null ? (
              <Line testID={`${testID}-goal`} x1={0} x2={width} y1={geo.goalY} y2={geo.goalY} stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="6 5" />
            ) : null}
            <Circle cx={geo.last[0]} cy={geo.last[1]} r={5} fill={colors.gold} stroke={colors.ground} strokeWidth={2} />
          </Svg>
        ) : null}
      </View>
      {geo ? (
        <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text {...CAP_BODY} style={styles.axisText}>
            {geo.first}
          </Text>
          <Text {...CAP_BODY} style={styles.axisText}>
            {geo.end}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  axisText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
