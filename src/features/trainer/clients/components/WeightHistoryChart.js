import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CurveType, LineChart } from 'react-native-gifted-charts';

import EmptyState from '../../../../shared/components/EmptyState';
import { colors, radii, shadows } from '../../../../shared/theme/tokens';
import { formatWeight } from '../clientFormat';
import { buildWeightSeries, thinLabels } from '../weightChartData';

const TEAL = '#009ca6';
const GRID = '#e2e8f0';
const AXIS_TEXT = { fontSize: 12, color: '#6b7280' };
const HEIGHT = 288;
const Y_AXIS_WIDTH = 40;
const MARGIN = { top: 10, right: 12, bottom: 8 };
const EDGE_LABEL_WIDTH = 64;

// gifted-charts centres each x label in a `spacing`-wide slot on its point, so
// the first and last slots hang half outside the clipped plot. Those two are
// anchored inward instead: the first starts at its point, the last ends there.
function edgeLabel(label, spacing, align) {
  const offset = align === 'left' ? spacing / 2 : spacing / 2 - EDGE_LABEL_WIDTH;
  return () => (
    <Text numberOfLines={1} style={[AXIS_TEXT, styles.edgeLabel, { left: offset, textAlign: align }]}>
      {label}
    </Text>
  );
}

// The weight chart (trainer clients spec §C5.3) on react-native-gifted-charts.
// Resolved mechanisms (owner-accepted): the "monotone" curve is drawn with
// the library's quadratic curve, and x labels are pre-thinned (thinLabels).
export default function WeightHistoryChart({ logs, profile }) {
  const [width, setWidth] = useState(0);
  const series = buildWeightSeries(logs, profile);

  // ⚠C-8: this empty state speaks to the member, as on the web.
  if (series.points.length < 2) {
    return (
      <EmptyState
        title="Not enough weight history yet"
        message="Add a few weight logs and the chart will start showing your trend."
      />
    );
  }

  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH - MARGIN.right);
  const spacing = series.points.length > 1 ? plotWidth / (series.points.length - 1) : plotWidth;
  const labels = thinLabels(
    series.points.map((point) => point.label),
    spacing
  );
  const range = series.max - series.min;
  // Grid lines must sit on the values their labels show: whole-kg steps when
  // the domain is a short whole range, else 4 sections labelled to 1 decimal.
  const wholeSteps = Number.isInteger(range) && range > 0 && range <= 8;
  const sections = wholeSteps ? range : 4;

  return (
    <View style={styles.wrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <LineChart
          data={series.points.map((point, index) => {
            const last = index === series.points.length - 1;
            const edge = index === 0 ? 'left' : last ? 'right' : null;
            return {
              value: point.value,
              label: labels[index],
              labelComponent: edge && labels[index] ? edgeLabel(labels[index], spacing, edge) : undefined,
            };
          })}
          width={plotWidth}
          height={HEIGHT - MARGIN.top - MARGIN.bottom - 24}
          initialSpacing={0}
          endSpacing={0}
          spacing={spacing}
          disableScroll
          areaChart
          curved
          curveType={CurveType.QUADRATIC}
          color={TEAL}
          thickness={2.5}
          startFillColor={TEAL}
          endFillColor={TEAL}
          startOpacity={0.22}
          endOpacity={0.02}
          dataPointsColor={TEAL}
          dataPointsRadius={3}
          customDataPoint={() => <View style={styles.dot} />}
          yAxisOffset={series.min}
          maxValue={range}
          noOfSections={sections}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisTextStyle={AXIS_TEXT}
          xAxisLabelTextStyle={AXIS_TEXT}
          formatYLabel={(label) => String(Math.round(Number(label) * 10) / 10)}
          rulesType="dashed"
          dashWidth={3}
          dashGap={3}
          rulesColor={GRID}
          showVerticalLines={false}
          pointerConfig={{
            pointerStripColor: GRID,
            pointerStripWidth: 1,
            pointerColor: TEAL,
            radius: 5,
            pointerComponent: () => <View style={styles.activeDot} />,
            pointerLabelWidth: 160,
            pointerLabelHeight: 70,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items, _secondary, index) => (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipLabel}>{series.points[index ?? 0]?.label}</Text>
                <Text style={styles.tooltipValue}>{formatWeight(items?.[0]?.value, series.unit)}</Text>
              </View>
            ),
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  edgeLabel: {
    position: 'absolute',
    top: 0,
    width: EDGE_LABEL_WIDTH,
  },
  wrap: {
    height: HEIGHT,
    paddingTop: MARGIN.top,
    paddingBottom: MARGIN.bottom,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEAL,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  activeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TEAL,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  tooltip: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    boxShadow: shadows.soft,
  },
  tooltipLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 2.64,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  tooltipValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
