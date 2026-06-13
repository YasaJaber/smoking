// ============================================================
// Analytics Dashboard - Statistics & Charts
// Premium dark theme with aurora gradients
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-gifted-charts';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
import {
  getAnalyticsSummary,
  getDailySales,
  getTopProducts,
  getOutstandingBalance,
  getDateNDaysAgo,
  getToday,
} from '../../../src/services/analyticsService';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { formatCurrency, formatCompact } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import type { AnalyticsSummary, DailySales, TopProduct } from '../../../src/types';

type Period = 'today' | 'week' | 'month' | 'all';

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const darkMode = useSettingsStore((s) => s.settings.dark_mode);
  const colors = darkMode ? Colors.dark : Colors.light;
  const currency = useSettingsStore((s) => s.settings.currency);

  const [period, setPeriod] = useState<Period>('week');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [outstanding, setOutstanding] = useState(0);

  useEffect(() => {
    loadData();
  }, [period]);

  const getDateRange = (p: Period): [string, string] => {
    const today = getToday();
    switch (p) {
      case 'today': return [today, today];
      case 'week': return [getDateNDaysAgo(7), today];
      case 'month': return [getDateNDaysAgo(30), today];
      case 'all': return [getDateNDaysAgo(365), today];
    }
  };

  const loadData = async () => {
    const [start, end] = getDateRange(period);
    const [summaryData, salesData, topData, outstandingData] = await Promise.all([
      getAnalyticsSummary(start, end),
      getDailySales(start, end),
      getTopProducts(start, end),
      getOutstandingBalance(),
    ]);
    setSummary(summaryData);
    setDailySales(salesData);
    setTopProducts(topData);
    setOutstanding(outstandingData);
  };

  const chartData = dailySales.map((d) => ({
    value: d.revenue,
    label: d.date.slice(5), // MM-DD
    frontColor: colors.primary,
    topLabelComponent: () => (
      <Text style={{ fontSize: 9, color: colors.textMuted }}>{formatCompact(d.revenue)}</Text>
    ),
  }));

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'اليوم' },
    { key: 'week', label: 'أسبوع' },
    { key: 'month', label: 'شهر' },
    { key: 'all', label: 'الكل' },
  ];
  const chartWidth = Math.max(240, Math.min(width - Spacing.base * 4, isCompact ? width - Spacing.base * 4 : 440));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>الإحصائيات</Text>
          <CurrentDateBadge />
        </View>
        <View style={styles.periodTabs}>
          {periods.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.periodTab, {
                backgroundColor: period === p.key ? colors.primary : colors.surfaceLight,
              }]}
            >
              <Text style={[styles.periodTabText, {
                color: period === p.key ? '#fff' : colors.textSecondary,
              }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Stats Cards Row */}
        <View style={[styles.statsRow, isCompact && styles.wrappingRow]}>
          {/* Revenue */}
          <Animated.View entering={FadeInDown.duration(300).delay(0)} style={[styles.statCardWrapper, isCompact && styles.statCardWrapperCompact]}>
            <LinearGradient
              colors={['rgba(99,102,241,0.15)', 'rgba(99,102,241,0.05)']}
              style={[styles.statCard, { borderColor: 'rgba(99,102,241,0.2)' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>الإيرادات</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {formatCurrency(summary?.total_revenue || 0, currency)}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Profit */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={[styles.statCardWrapper, isCompact && styles.statCardWrapperCompact]}>
            <LinearGradient
              colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']}
              style={[styles.statCard, { borderColor: 'rgba(16,185,129,0.2)' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                <MaterialCommunityIcons name="trending-up" size={22} color={colors.accent} />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>صافي الربح</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {formatCurrency(summary?.total_profit || 0, currency)}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Invoices */}
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={[styles.statCardWrapper, isCompact && styles.statCardWrapperCompact]}>
            <LinearGradient
              colors={['rgba(167,139,250,0.15)', 'rgba(167,139,250,0.05)']}
              style={[styles.statCard, { borderColor: 'rgba(167,139,250,0.2)' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: 'rgba(167,139,250,0.2)' }]}>
                <MaterialCommunityIcons name="receipt" size={22} color={colors.secondary} />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>الفواتير</Text>
              <Text style={[styles.statValue, { color: colors.secondary }]}>
                {summary?.total_invoices || 0}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Outstanding */}
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={[styles.statCardWrapper, isCompact && styles.statCardWrapperCompact]}>
            <LinearGradient
              colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']}
              style={[styles.statCard, { borderColor: 'rgba(245,158,11,0.2)' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المتبقي</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {formatCurrency(outstanding, currency)}
              </Text>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Chart + Top Products Row */}
        <View style={[styles.chartsRow, isCompact && styles.stackedColumn]}>
          {/* Sales Chart */}
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={[styles.chartCard, isCompact && styles.fullWidthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={colors.primary} />
              {'  '}حركة المبيعات
            </Text>
            {chartData.length > 0 ? (
              <BarChart
                data={chartData}
                barWidth={isCompact ? 20 : 28}
                spacing={isCompact ? 10 : 16}
                noOfSections={4}
                barBorderRadius={6}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor={colors.border}
                yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
                hideRules
                isAnimated
                animationDuration={500}
                height={160}
                width={chartWidth}
              />
            ) : (
              <View style={styles.noDataChart}>
                <MaterialCommunityIcons name="chart-line-variant" size={40} color={colors.textMuted} />
                <Text style={[styles.noDataText, { color: colors.textMuted }]}>لا توجد بيانات</Text>
              </View>
            )}
          </Animated.View>

          {/* Top Products */}
          <Animated.View entering={FadeInUp.duration(400).delay(300)} style={[styles.topCard, isCompact && styles.fullWidthCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              <MaterialCommunityIcons name="fire" size={18} color={colors.danger} />
              {'  '}الأكثر مبيعاً
            </Text>
            {topProducts.length > 0 ? (
              topProducts.map((prod, index) => (
                <View key={prod.product_id} style={[styles.topItem, { borderBottomColor: colors.border }]}>
                  <View style={[styles.topRank, { backgroundColor: index === 0 ? colors.primaryGlow : colors.surfaceLight }]}>
                    <Text style={[styles.topRankText, { color: index === 0 ? colors.primary : colors.textMuted }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.topInfo}>
                    <Text style={[styles.topName, { color: colors.text }]} numberOfLines={1}>
                      {prod.product_name}
                    </Text>
                    <Text style={[styles.topSold, { color: colors.textMuted }]}>
                      {prod.total_sold} قطعة
                    </Text>
                  </View>
                  <Text style={[styles.topRevenue, { color: colors.accent }]}>
                    {formatCurrency(prod.total_revenue, currency)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.noDataChart}>
                <Text style={[styles.noDataText, { color: colors.textMuted }]}>لا توجد مبيعات</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {/* Extra Stats Row */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)} style={[styles.extraStats, isCompact && styles.stackedColumn]}>
          <View style={[styles.extraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cart-arrow-down" size={20} color={colors.primary} />
            <Text style={[styles.extraLabel, { color: colors.textSecondary }]}>إجمالي القطع المباعة</Text>
            <Text style={[styles.extraValue, { color: colors.text }]}>{summary?.total_items_sold || 0}</Text>
          </View>
          <View style={[styles.extraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="calculator-variant" size={20} color={colors.secondary} />
            <Text style={[styles.extraLabel, { color: colors.textSecondary }]}>متوسط الفاتورة</Text>
            <Text style={[styles.extraValue, { color: colors.text }]}>
              {formatCurrency(summary?.avg_invoice_value || 0, currency)}
            </Text>
          </View>
          <View style={[styles.extraCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="percent-outline" size={20} color={colors.accent} />
            <Text style={[styles.extraLabel, { color: colors.textSecondary }]}>هامش الربح</Text>
            <Text style={[styles.extraValue, { color: colors.accent }]}>
              {summary && summary.total_revenue > 0
                ? `${((summary.total_profit / summary.total_revenue) * 100).toFixed(1)}%`
                : '0%'}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  periodTabs: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  periodTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  periodTabText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  scrollContent: { padding: Spacing.base },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  statCardWrapper: { flex: 1 },
  wrappingRow: { flexWrap: 'wrap' },
  statCardWrapperCompact: { minWidth: '47%' },
  statCard: {
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  statLabel: { fontSize: Typography.fontSize.xs, fontWeight: '500' },
  statValue: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  chartsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  stackedColumn: {
    flexDirection: 'column',
  },
  chartCard: {
    flex: 0.6,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
  },
  topCard: {
    flex: 0.4,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
  },
  fullWidthCard: {
    flex: 1,
    width: '100%',
  },
  chartTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  noDataChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.sm,
  },
  noDataText: { fontSize: Typography.fontSize.sm },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  topRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRankText: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  topInfo: { flex: 1 },
  topName: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  topSold: { fontSize: Typography.fontSize.xs, marginTop: 1 },
  topRevenue: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  extraStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  extraCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  extraLabel: { fontSize: Typography.fontSize.xs, textAlign: 'center' },
  extraValue: { fontSize: Typography.fontSize.md, fontWeight: '800' },
});
