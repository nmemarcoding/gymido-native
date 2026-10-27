import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import EmptyState from '../../../../shared/components/EmptyState';
import { TOOLTIP_BOX } from '../../../../shared/components/tooltipStyle';
import { colors, font } from '../../../../shared/theme/tokens';
import { formatWeight } from '../clientFormat';
import { buildWeightSeries, monotoneXPath, thinLabels, tickLabel } from '../weightChartData';

const TEAL = colors.chartLine;
const GRID = colors.chartGrid;
const AXIS_COLOR = colors.textMuted;
const FONT_SIZE = 12;
const HEIGHT = 288;
const Y_AXIS_WIDTH = 44;
const X_AXIS_HEIGHT = 30;
const MARGIN = { top: 10, right: 12, bottom: 8 };
// Recharts axis geometry: tick labels sit tickSize (6) + tickMargin (2) off
// the plot; the y label baseline is centred (0.355em), the x one drops 0.71em.
const LABEL_OFFSET = 8;
const Y_LABEL_DY = FONT_SIZE * 0.355;
const X_LABEL_DY = FONT_SIZE * 0.71;
const TOOLTIP_GAP = 10;

// The weight chart (trainer clients spec §C5.3), drawn with react-native-svg
// so it matches the web's Recharts output: a d3 monotoneX curve, the
// whole-number y ticks of §C5.3 (T-38), and the first/last x labels kept inside the
// plot (preserveStartEnd). `unit` (optional) is the chart's one unit (T-38):
// Progress passes its currentUnit (RN-SPEC-progress §PR1.2); without it the
// trainer rule (§C5.3) picks it. `showGoal` (client weight modal, UX M
// ruling 1): a dashed teal goal line at the profile's goal (as drawn: teal
// 0.6, dash 4 5); the axis keeps it inside.
export default function WeightHistoryChart({ logs, profile, unit, showGoal = false }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const series = buildWeightSeries(logs, profile, unit, { withGoal: showGoal });

  // ⚠C-8: this empty state speaks to the member, as on the web.
  if (series.points.length < 2) {
    return (
      <EmptyState
        title="Not enough weight history yet"
        message="Add a few weight logs and the chart will start showing your trend."
      />
    );
  }

  const left = Y_AXIS_WIDTH;
  const right = Math.max(left, width - MARGIN.right);
  const top = MARGIN.top;
  const bottom = HEIGHT - MARGIN.bottom - X_AXIS_HEIGHT;
  const spacing = (right - left) / (series.points.length - 1);
  const xAt = (index) => left + index * spacing;
  const yAt = (value) => bottom - ((value - series.min) / (series.max - series.min)) * (bottom - top);

  const coords = series.points.map((point, index) => [xAt(index), yAt(point.value)]);
  const line = monotoneXPath(coords);
  const area = `${line}L${coords[coords.length - 1][0]},${bottom}L${coords[0][0]},${bottom}Z`;
  const { ticks } = series;
  const labels = thinLabels(
    series.points.map((point) => point.label),
    spacing
  );
  const lastIndex = labels.length - 1;

  function pick(event) {
    const index = Math.round((event.nativeEvent.locationX - left) / spacing);
    setActiveIndex(Math.min(lastIndex, Math.max(0, index)));
  }

  const active = activeIndex === null ? null : series.points[activeIndex];
  const activeX = activeIndex === null ? 0 : xAt(activeIndex);
  const tooltipLeft =
    activeX + TOOLTIP_GAP + tooltipWidth <= width
      ? activeX + TOOLTIP_GAP
      : Math.max(0, activeX - TOOLTIP_GAP - tooltipWidth);

  return (
    <View style={styles.wrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => true}
          onResponderGrant={pick}
          onResponderMove={pick}
        >
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={TEAL} stopOpacity={0.22} />
                <Stop offset="1" stopColor={TEAL} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {ticks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                x1={left}
                x2={right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke={GRID}
                strokeDasharray="3 3"
              />
            ))}
            {ticks.map((tick) => (
              <SvgText
                key={`y-${tick}`}
                x={left - LABEL_OFFSET}
                y={yAt(tick) + Y_LABEL_DY}
                fontSize={FONT_SIZE}
                fill={AXIS_COLOR}
                textAnchor="end"
              >
                {tickLabel(tick)}
              </SvgText>
            ))}
            {labels.map((label, index) =>
              label ? (
                <SvgText
                  key={`x-${index}`}
                  x={index === 0 ? left : index === lastIndex ? right : xAt(index)}
                  y={bottom + LABEL_OFFSET + X_LABEL_DY}
                  fontSize={FONT_SIZE}
                  fill={AXIS_COLOR}
                  textAnchor={index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'}
                >
                  {label}
                </SvgText>
              ) : null
            )}
            {series.goal !== null ? (
              <Line
                testID="weight-chart-goal-line"
                x1={left}
                x2={right}
                y1={yAt(series.goal)}
                y2={yAt(series.goal)}
                stroke={colors.tealStrong}
                strokeWidth={1.5}
                strokeDasharray="4 5"
              />
            ) : null}
            <Path d={area} fill="url(#weightFill)" />
            <Path d={line} fill="none" stroke={TEAL} strokeWidth={2.5} />
            {active ? <Line x1={activeX} x2={activeX} y1={top} y2={bottom} stroke={GRID} strokeWidth={1} /> : null}
            {coords.map(([x, y], index) => (
              <Circle key={`dot-${index}`} cx={x} cy={y} r={3} fill={TEAL} stroke={colors.surface} strokeWidth={2} />
            ))}
            {active ? (
              <Circle cx={activeX} cy={yAt(active.value)} r={5} fill={TEAL} stroke={colors.surface} strokeWidth={2} />
            ) : null}
          </Svg>
          {active ? (
            <View
              pointerEvents="none"
              onLayout={(event) => setTooltipWidth(event.nativeEvent.layout.width)}
              style={[styles.tooltip, { left: tooltipLeft, top }]}
            >
              <Text style={styles.tooltipLabel}>{active.label}</Text>
              <Text style={styles.tooltipValue}>{formatWeight(active.value, series.unit)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEIGHT,
  },
  // UX ruling (T-61): the kit tooltip container, as the rail tip.
  tooltip: {
    position: 'absolute',
    ...TOOLTIP_BOX,
  },
  // Board chart dates: 13 px muted regular, sentence case.
  tooltipLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    color: colors.textMuted,
  },
  // The value: 15/600 primary, tabular (UX ruling, T-61).
  tooltipValue: {
    marginTop: 2,
    ...font(600),
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
