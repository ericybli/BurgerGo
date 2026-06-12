/**
 * Settings (global server row, id=1) — Atlas Light port of the web
 * `components/SettingsClient.tsx`. Card order mirrors the web: Language &
 * Currency → Map → AI place summaries → About → Offline & data. The "Settings"
 * title + back chevron come from the root stack header (web header adaptation).
 */
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useOnline } from '../../lib/online';
import { CURRENCIES } from '../../lib/currency';
import { AI_MODELS, DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT } from '../../lib/aiDefaults';
import { APP_VERSION } from '../../lib/appVersion';
import { colors, type } from '../../lib/theme';
import { Button, Card, Field, Loading, OfflineHint, Screen, Select } from '../../components/ui';
import { loadSettings, patchSettings } from './settingsApi';
import { ProfileCard } from './ProfileCard';
import { downloadAllForOffline, type SyncProgress } from '../../lib/offlineSync';
import {
  clearJsonCache,
  clearPhotoCache,
  getOfflineMeta,
  setOfflineMeta,
  type OfflineMeta,
} from '../../lib/offlineStore';

type Status = 'idle' | 'saved' | 'error';

const SAVE_ERROR = "Couldn't save — please try again.";

export function SettingsScreen() {
  const online = useOnline();
  const [loaded, setLoaded] = useState(false);
  const [currency, setCurrency] = useState('USD');
  // Map pin clustering: on by default (null/undefined/true → true); only false turns it off.
  const [clusterPins, setClusterPins] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<string>(DEFAULT_AI_MODEL);
  const [curStatus, setCurStatus] = useState<Status>('idle');
  const [mapStatus, setMapStatus] = useState<Status>('idle');
  const [aiStatus, setAiStatus] = useState<Status>('idle');
  const [curBusy, setCurBusy] = useState(false);
  // Offline download (Card 5)
  const [offlineMeta, setOfflineMetaState] = useState<OfflineMeta | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [clearArmed, setClearArmed] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState(false);
  useEffect(() => {
    void getOfflineMeta().then(setOfflineMetaState);
  }, []);
  useEffect(() => {
    if (!clearArmed) return;
    const t = setTimeout(() => setClearArmed(false), 3000);
    return () => clearTimeout(t);
  }, [clearArmed]);
  const [mapBusy, setMapBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings()
      .then((row) => {
        if (!active) return;
        setCurrency(row?.currency ?? 'USD');
        setClusterPins(row?.clusterPins !== false);
        setAiPrompt(row?.aiPrompt ?? '');
        // Coerce any stored value to one of the dropdown options (else default);
        // display-only — never auto-save the coercion.
        setAiModel(row?.aiModel && AI_MODELS.includes(row.aiModel) ? row.aiModel : DEFAULT_AI_MODEL);
      })
      .catch(() => {
        /* offline / no cache → keep defaults */
      })
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) return <Loading label="Loading settings…" />;

  // Keep the stored currency selectable even if it's outside the built-in list.
  const currencyOptions = CURRENCIES.some((c) => c.code === currency)
    ? CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` }))
    : [
        { value: currency, label: currency },
        ...CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.label}` })),
      ];

  async function saveCurrency(next: string) {
    setCurrency(next); // optimistic; web does NOT revert on failure
    setCurStatus('idle');
    setCurBusy(true);
    try {
      await patchSettings({ currency: next });
      setCurStatus('saved');
    } catch {
      setCurStatus('error');
    } finally {
      setCurBusy(false);
    }
  }

  async function saveCluster(next: boolean) {
    setClusterPins(next); // optimistic
    setMapStatus('idle');
    setMapBusy(true);
    try {
      await patchSettings({ clusterPins: next });
      setMapStatus('saved');
    } catch {
      setClusterPins(!next); // revert optimistic toggle on failure (web parity)
      setMapStatus('error');
    } finally {
      setMapBusy(false);
    }
  }

  async function saveAi() {
    setAiBusy(true);
    setAiStatus('idle');
    try {
      // Always send BOTH keys — the server treats key-presence as intent;
      // blank values clear the overrides (stored as NULL).
      await patchSettings({ prompt: aiPrompt, model: aiModel });
      setAiStatus('saved');
    } catch {
      setAiStatus('error');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleClearOffline() {
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    setClearBusy(true);
    setClearError(false);
    try {
      await clearJsonCache();
      await clearPhotoCache();
      await setOfflineMeta(null);
      setOfflineMetaState(null);
    } catch {
      setClearError(true);
    } finally {
      setClearBusy(false);
    }
  }

  /** Local-only: clears the fields; the user must still hit Save to persist. */
  function resetAi() {
    setAiPrompt('');
    setAiModel(DEFAULT_AI_MODEL);
    setAiStatus('idle');
  }

  const clusterDisabled = !online || mapBusy;

  return (
    <Screen scroll>
      {/* Card 0 — Profile (account, avatar, sign-out) */}
      <ProfileCard online={online} />

      {/* Card 1 — Language & Currency */}
      <Card style={styles.cardSpace}>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Language</Text>
          <Text style={styles.rowValue}>English</Text>
        </View>
        <View style={styles.divider} />
        <Select
          label="Currency"
          value={currency}
          options={currencyOptions}
          onChange={saveCurrency}
          disabled={!online || curBusy}
        />
        <Text
          style={[
            styles.status,
            curStatus === 'saved' && { color: colors.accent },
            curStatus === 'error' && { color: colors.danger },
          ]}
        >
          {curStatus === 'saved'
            ? 'Currency saved ✓'
            : curStatus === 'error'
              ? SAVE_ERROR
              : 'Used for all amounts across the trip.'}
        </Text>
        {!online ? <OfflineHint /> : null}
      </Card>

      {/* Card 2 — Map */}
      <Card style={styles.cardSpace}>
        <Text style={styles.cardTitle}>Map</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: clusterPins, disabled: clusterDisabled }}
          onPress={() => {
            if (!clusterDisabled) void saveCluster(!clusterPins);
          }}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && !clusterDisabled && { backgroundColor: colors.accentTint },
          ]}
        >
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Cluster nearby pins</Text>
            <Text style={styles.toggleHint}>
              Group close-together pins into a count bubble that splits apart as you zoom in. Turn
              off to always show every pin.
            </Text>
          </View>
          <Switch
            value={clusterPins}
            onValueChange={saveCluster}
            disabled={clusterDisabled}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.line}
            accessibilityLabel="Cluster nearby pins"
            style={clusterDisabled ? { opacity: 0.6 } : null}
          />
        </Pressable>
        {mapStatus === 'saved' ? (
          <Text style={[styles.status, { color: colors.accent }]}>Saved ✓</Text>
        ) : mapStatus === 'error' ? (
          <Text style={[styles.status, { color: colors.danger }]}>{SAVE_ERROR}</Text>
        ) : null}
        {!online ? <OfflineHint /> : null}
      </Card>

      {/* Card 3 — AI place summaries */}
      <Card style={styles.cardSpace}>
        <Text style={styles.cardTitle}>AI place summaries</Text>
        <Text style={styles.cardBody}>
          Customize how AI writes each place's intro. Leave blank to use the built-in defaults.
        </Text>
        <Select
          label="Model"
          value={aiModel}
          options={AI_MODELS.map((m) => ({ value: m, label: m }))}
          onChange={(m) => {
            setAiModel(m);
            setAiStatus('idle');
          }}
          disabled={!online || aiBusy}
        />
        <Field
          label="Prompt"
          value={aiPrompt}
          onChangeText={(t) => {
            setAiPrompt(t);
            setAiStatus('idle');
          }}
          placeholder={DEFAULT_AI_PROMPT}
          multiline
          editable={online && !aiBusy}
          style={styles.promptInput}
        />
        <Text style={styles.hint}>
          The system prompt. Leave blank for the built-in Chinese, beginner-friendly default.
        </Text>
        <View style={styles.aiActions}>
          <Button title="Save" onPress={saveAi} busy={aiBusy} disabled={!online} />
          <Button
            title="Reset to default"
            variant="text"
            onPress={resetAi}
            disabled={!online || aiBusy}
          />
          {aiStatus === 'saved' ? (
            <Text style={[styles.aiStatus, { color: colors.sub }]}>Saved</Text>
          ) : aiStatus === 'error' ? (
            <Text style={[styles.aiStatus, { color: colors.danger }]}>{SAVE_ERROR}</Text>
          ) : null}
        </View>
        {!online ? <OfflineHint /> : null}
      </Card>

      {/* Card 4 — About */}
      <Card style={[styles.cardSpace, styles.aboutCard]}>
        <Image
          source={require('../../assets/burgergo-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="BurgerGo the Siamese cat"
        />
        <Text style={styles.appName}>BurgerGo</Text>
        <Text style={styles.tagline}>Your personal travel companion</Text>
        <Text style={styles.version}>Version {APP_VERSION}</Text>
      </Card>

      {/* Card 5 — Offline download + Your data (one card, divided) */}
      <Card style={styles.cardSpace}>
        <Text style={styles.cardTitle}>Offline</Text>
        <Text style={styles.cardBody}>
          Download every trip — plans, eats, journal, tickets, and photos — to
          use the app without a connection. Editing still needs one.
        </Text>
        <Text style={styles.offlineStatus}>
          {syncing && syncProgress
            ? syncProgress.phase === 'data'
              ? `Fetching ${syncProgress.label}…`
              : `Photos ${syncProgress.done}/${syncProgress.total}…`
            : offlineMeta
              ? `Last downloaded ${formatWhen(offlineMeta.ts)} · ${offlineMeta.files} photos · ${(
                  offlineMeta.bytes / 1048576
                ).toFixed(1)} MB`
              : 'Nothing downloaded yet.'}
        </Text>
        {syncError ? (
          <Text style={styles.offlineError}>Couldn't download — check your connection.</Text>
        ) : null}
        <Button
          title={offlineMeta ? 'Refresh offline data' : 'Download for offline'}
          busy={syncing}
          disabled={!online || syncing}
          onPress={() => {
            setSyncing(true);
            setSyncError(false);
            void downloadAllForOffline(setSyncProgress)
              .then((m) => setOfflineMetaState(m))
              .catch(() => setSyncError(true))
              .finally(() => {
                setSyncing(false);
                setSyncProgress(null);
              });
          }}
          style={styles.offlineBtn}
        />
        {offlineMeta ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={syncing || clearBusy}
              onPress={() => void handleClearOffline()}
              style={({ pressed }) => [
                styles.clearBtn,
                pressed && !syncing && !clearBusy && { opacity: 0.6 },
                (syncing || clearBusy) && { opacity: 0.4 },
              ]}
            >
              <Text style={styles.clearBtnText}>
                {clearBusy
                  ? 'Clearing…'
                  : clearArmed
                    ? 'Sure? Clear offline data'
                    : 'Clear offline data'}
              </Text>
            </Pressable>
            {clearError ? (
              <Text style={styles.offlineError}>Couldn't clear — please try again.</Text>
            ) : null}
          </>
        ) : null}
        {!online ? <OfflineHint /> : null}
        <View style={styles.divider} />
        <Text style={styles.cardTitle}>Your data</Text>
        <Text style={styles.cardBody}>
          All your data lives in a SQLite database on your own server.
        </Text>
        <Text style={styles.subBody}>Back it up by copying that database file.</Text>
      </Card>
    </Screen>
  );
}

/** "Jun 10, 14:32" without Intl (Hermes-safe). */
function formatWhen(ts: number): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { ...type.body, color: colors.ink },
  rowValue: { ...type.label, color: colors.sub },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: 12 },
  offlineStatus: { ...type.caption, color: colors.sub, marginTop: 10 },
  offlineError: { ...type.caption, color: colors.danger, marginTop: 6 },
  offlineBtn: { marginTop: 12 },
  clearBtn: { marginTop: 12, alignSelf: 'center' },
  clearBtnText: { ...type.caption, color: colors.danger },
  status: { ...type.caption, marginTop: 10, color: colors.faint },
  cardSpace: { marginTop: 16 },
  cardTitle: { ...type.heading, color: colors.ink },
  cardBody: { ...type.caption, marginTop: 4, color: colors.sub, lineHeight: 17 },
  subBody: { ...type.caption, marginTop: 4, color: colors.faint },
  hint: { ...type.caption, marginTop: 6, color: colors.faint, lineHeight: 17 },
  promptInput: { minHeight: 150 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  toggleText: { flex: 1, minWidth: 0 },
  toggleLabel: { ...type.body, color: colors.ink },
  toggleHint: { ...type.caption, marginTop: 2, color: colors.sub },

  aiActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' },
  aiStatus: { ...type.caption },

  aboutCard: { alignItems: 'center', padding: 24 },
  logo: { width: 88, height: 88, opacity: 0.9 },
  appName: { ...type.heading, marginTop: 12, color: colors.ink },
  tagline: { ...type.caption, marginTop: 4, color: colors.sub },
  version: { ...type.caption, marginTop: 8, color: colors.faint, fontVariant: ['tabular-nums'] },
});
