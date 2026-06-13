// ============================================================
// Settings Screen - App configuration
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { useSyncStore } from '../../../src/stores/syncStore';
import { CurrentDateBadge } from '../../../src/components/common/CurrentDateBadge';
import { getDatabase } from '../../../src/db/client';
import { formatDateTime } from '../../../src/utils/formatters';
import { Colors, Gradients, Typography, Spacing, BorderRadius } from '../../../src/constants/theme';
import { router } from 'expo-router';

type ThemeColors = typeof Colors.dark | typeof Colors.light;

// NOTE: These are defined OUTSIDE the screen component on purpose.
// If they live inside, every keystroke re-creates them and React remounts
// the children (including TextInputs), which dismisses the keyboard.
const SettingSection = ({
  title,
  icon,
  children,
  delay = 0,
  colors,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  delay?: number;
  colors: ThemeColors;
}) => (
  <Animated.View entering={FadeInDown.duration(300).delay(delay)}>
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  </Animated.View>
);

const SettingRow = ({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) => (
  <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
    <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>{label}</Text>
    <View style={styles.settingValue}>{children}</View>
  </View>
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const { settings, updateSettings } = useSettingsStore();
  const { logout } = useAuthStore();
  const syncStatus = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastSyncIso = useSyncStore((s) => s.lastSyncIso);
  const syncError = useSyncStore((s) => s.error);
  const runSync = useSyncStore((s) => s.sync);
  const refreshSyncStatus = useSyncStore((s) => s.refreshStatus);
  const colors = settings.dark_mode ? Colors.dark : Colors.light;

  const [storeName, setStoreName] = useState(settings.store_name);
  const [phone, setPhone] = useState(settings.phone);
  const [taxRate, setTaxRate] = useState((settings.tax_rate * 100).toString());
  const [welcomeMsg, setWelcomeMsg] = useState(settings.welcome_message);
  const [footerMsg, setFooterMsg] = useState(settings.footer_message);
  const [lowStock, setLowStock] = useState(settings.low_stock_threshold.toString());
  const [serverUrl, setServerUrl] = useState(settings.server_url);

  const handleSave = async () => {
    await updateSettings({
      store_name: storeName,
      phone,
      tax_rate: (parseFloat(taxRate) || 0) / 100,
      welcome_message: welcomeMsg,
      footer_message: footerMsg,
      low_stock_threshold: parseInt(lowStock) || 5,
      server_url: serverUrl.trim(),
    });
    await refreshSyncStatus();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅', 'تم حفظ الإعدادات بنجاح');
  };

  const handleSyncNow = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('تنبيه', 'اكتب عنوان السيرفر واحفظ الإعدادات الأول');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await runSync(false);
  };

  const syncStatusLabel = (() => {
    switch (syncStatus) {
      case 'syncing': return 'جاري المزامنة...';
      case 'success': return 'تمت المزامنة بنجاح';
      case 'error': return syncError || 'فشلت المزامنة';
      case 'offline': return 'لا يوجد اتصال بالإنترنت';
      case 'disabled': return 'المزامنة غير مفعلة';
      default: return 'جاهز';
    }
  })();

  const handleResetDB = () => {
    Alert.alert(
      '⚠️ تحذير',
      'هل تريد مسح جميع البيانات وإعادة ضبط النظام؟ هذا الإجراء لا يمكن التراجع عنه!',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح الكل',
          style: 'destructive',
          onPress: async () => {
            const db = await getDatabase();
            await db.execAsync(`
              DELETE FROM invoice_items;
              DELETE FROM invoices;
              DELETE FROM sync_log;
            `);
            Alert.alert('✅', 'تم مسح بيانات المبيعات');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>الإعدادات</Text>
        <CurrentDateBadge />
        <Pressable onPress={handleSave}>
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            <MaterialCommunityIcons name="content-save" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>حفظ</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.columns, isCompact && styles.columnsCompact]}>
          {/* Left Column */}
          <View style={styles.column}>
            {/* Store Info */}
            <SettingSection title="معلومات المحل" icon="store" delay={0} colors={colors}>
              <SettingRow label="اسم المحل" colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={storeName}
                  onChangeText={setStoreName}
                />
              </SettingRow>
              <SettingRow label="رقم التليفون" colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </SettingRow>
            </SettingSection>

            {/* Tax Settings */}
            <SettingSection title="الضرائب" icon="percent" delay={100} colors={colors}>
              <SettingRow label="تفعيل الضريبة" colors={colors}>
                <Switch
                  value={settings.tax_enabled}
                  onValueChange={(v) => updateSettings({ tax_enabled: v })}
                  trackColor={{ false: colors.surfaceLight, true: colors.primaryGlow }}
                  thumbColor={settings.tax_enabled ? colors.primary : colors.textMuted}
                />
              </SettingRow>
              {settings.tax_enabled && (
                <SettingRow label="نسبة الضريبة (%)" colors={colors}>
                  <TextInput
                    style={[styles.input, styles.smallInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                    value={taxRate}
                    onChangeText={setTaxRate}
                    keyboardType="decimal-pad"
                  />
                </SettingRow>
              )}
            </SettingSection>

            {/* Appearance */}
            <SettingSection title="المظهر" icon="palette" delay={200} colors={colors}>
              <SettingRow label="الوضع الداكن" colors={colors}>
                <Switch
                  value={settings.dark_mode}
                  onValueChange={(v) => updateSettings({ dark_mode: v })}
                  trackColor={{ false: colors.surfaceLight, true: colors.primaryGlow }}
                  thumbColor={settings.dark_mode ? colors.primary : colors.textMuted}
                />
              </SettingRow>
            </SettingSection>
          </View>

          {/* Right Column */}
          <View style={styles.column}>
            {/* Printing */}
            <SettingSection title="الطباعة" icon="printer" delay={100} colors={colors}>
              <SettingRow label="رسالة الترحيب" colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={welcomeMsg}
                  onChangeText={setWelcomeMsg}
                />
              </SettingRow>
              <SettingRow label="رسالة الختام" colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={footerMsg}
                  onChangeText={setFooterMsg}
                />
              </SettingRow>
            </SettingSection>

            {/* Inventory */}
            <SettingSection title="المخزون" icon="package-variant" delay={200} colors={colors}>
              <SettingRow label="حد المخزون المنخفض" colors={colors}>
                <TextInput
                  style={[styles.input, styles.smallInput, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text }]}
                  value={lowStock}
                  onChangeText={setLowStock}
                  keyboardType="number-pad"
                />
              </SettingRow>
            </SettingSection>

            {/* Cloud Sync */}
            <SettingSection title="المزامنة السحابية" icon="cloud-sync" delay={250} colors={colors}>
              <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.md, paddingTop: Spacing.sm }}>
                <Text style={[styles.settingLabel, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
                  عنوان السيرفر
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.border, color: colors.text, textAlign: 'left' }]}
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="http://192.168.1.10:4000"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <View style={[styles.syncStatusRow, { borderTopColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                    <MaterialCommunityIcons
                      name={syncStatus === 'error' ? 'cloud-alert' : syncStatus === 'success' ? 'cloud-check' : 'cloud-outline'}
                      size={16}
                      color={syncStatus === 'error' ? colors.danger : syncStatus === 'success' ? colors.accent : colors.textMuted}
                    />
                    <Text style={[styles.syncStatusText, { color: syncStatus === 'error' ? colors.danger : colors.textSecondary }]}>
                      {syncStatusLabel}
                    </Text>
                  </View>
                  {pendingCount > 0 && (
                    <Text style={[styles.syncStatusText, { color: colors.warning }]}>
                      {pendingCount} في الانتظار
                    </Text>
                  )}
                </View>

                {lastSyncIso && (
                  <Text style={[styles.syncMeta, { color: colors.textMuted }]}>
                    آخر مزامنة: {formatDateTime(lastSyncIso)}
                  </Text>
                )}

                <Pressable onPress={handleSyncNow} style={{ marginTop: Spacing.md }}>
                  <LinearGradient
                    colors={Gradients.emeraldTeal as unknown as readonly [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtn}
                  >
                    <MaterialCommunityIcons name="sync" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>مزامنة الآن</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </SettingSection>

            {/* Danger Zone */}
            <SettingSection title="منطقة الخطر" icon="alert-octagon" delay={300} colors={colors}>
              <Pressable onPress={handleResetDB} style={[styles.dangerBtn, { borderColor: colors.danger }]}>
                <MaterialCommunityIcons name="delete-forever" size={18} color={colors.danger} />
                <Text style={[styles.dangerBtnText, { color: colors.danger }]}>
                  مسح بيانات المبيعات
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  logout();
                  router.replace('/');
                }}
                style={[styles.logoutFullBtn, { backgroundColor: colors.surfaceLight }]}
              >
                <MaterialCommunityIcons name="logout" size={18} color={colors.textSecondary} />
                <Text style={[styles.logoutFullText, { color: colors.textSecondary }]}>
                  تسجيل الخروج
                </Text>
              </Pressable>
            </SettingSection>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appInfoText, { color: colors.textMuted }]}>
            Smoking POS v1.0.0 • صُنع بـ ❤️
          </Text>
        </View>
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
  headerTitle: { fontSize: Typography.fontSize.lg, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  saveBtnText: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '600' },
  scrollContent: { padding: Spacing.base },
  columns: { flexDirection: 'row', gap: Spacing.md },
  columnsCompact: { flexDirection: 'column' },
  column: { flex: 1, gap: Spacing.md },
  section: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
  },
  sectionTitle: { fontSize: Typography.fontSize.base, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  settingLabel: { fontSize: Typography.fontSize.sm, fontWeight: '500', flex: 1 },
  settingValue: { flex: 1, minWidth: 160, alignItems: 'stretch' },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    width: '100%',
    textAlign: 'right',
  },
  smallInput: { width: 80 },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  syncStatusText: { fontSize: Typography.fontSize.xs, fontWeight: '600' },
  syncMeta: { fontSize: Typography.fontSize.xs, marginTop: Spacing.xs },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    margin: Spacing.base,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  dangerBtnText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  logoutFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  logoutFullText: { fontSize: Typography.fontSize.sm, fontWeight: '600' },
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  appInfoText: { fontSize: Typography.fontSize.xs },
});
