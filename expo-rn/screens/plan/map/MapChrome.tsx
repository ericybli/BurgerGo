/**
 * Floating Atlas controls over the map canvas (shared by both platforms):
 * Layers pill + menu (top-left, days bucket), fullscreen (top-right),
 * satellite pill (bottom-left), locate + POI toggle (bottom-right). These keep
 * the web's translucent bg + soft lift shadow (they sit over imagery — the one
 * allowed shadow exception besides pins).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Landmark,
  Layers,
  LocateFixed,
  Maximize,
  Minimize,
} from 'lucide-react-native';
import { colors, font } from '../../../lib/theme';

export function MapChrome({
  showLayers,
  layersOpen,
  onToggleLayersMenu,
  showSaved,
  onToggleSaved,
  showRoutes,
  onToggleRoutes,
  showRestaurants,
  onToggleRestaurants,
  fullscreen,
  onToggleFullscreen,
  satellite,
  onToggleSatellite,
  locating,
  onLocate,
  poiSupported,
  poiEnabled,
  onTogglePoi,
  raised = false,
}: {
  /** Layers button renders in the days bucket only. */
  showLayers: boolean;
  layersOpen: boolean;
  onToggleLayersMenu: () => void;
  showSaved: boolean;
  onToggleSaved: () => void;
  showRoutes: boolean;
  onToggleRoutes: () => void;
  showRestaurants: boolean;
  onToggleRestaurants: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  satellite: boolean;
  onToggleSatellite: () => void;
  locating: boolean;
  onLocate: () => void;
  poiSupported: boolean;
  poiEnabled: boolean;
  onTogglePoi: () => void;
  /**
   * Lift the bottom-anchored controls +90 when the canvas runs underneath the
   * floating glass tab bar (visual only — inline, non-fullscreen, no route
   * links row below the map).
   */
  raised?: boolean;
}) {
  return (
    <>
      {showLayers ? (
        <View style={s.layersWrap} pointerEvents="box-none">
          <Pressable
            onPress={onToggleLayersMenu}
            accessibilityLabel="Layers"
            accessibilityState={{ expanded: layersOpen }}
            style={({ pressed }) => [s.layersBtn, pressed && s.pressed]}
          >
            <Layers size={16} strokeWidth={1.75} color={colors.ink} />
            <Text style={s.layersText}>Layers</Text>
          </Pressable>
          {layersOpen ? (
            <View style={s.layersMenu}>
              <LayerRow label="Routes" value={showRoutes} onToggle={onToggleRoutes} />
              <LayerRow label="Saved places" value={showSaved} onToggle={onToggleSaved} />
              <LayerRow label="Restaurants" value={showRestaurants} onToggle={onToggleRestaurants} />
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onToggleFullscreen}
        accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        style={({ pressed }) => [s.roundBtn, s.fullscreenBtn, pressed && s.pressed]}
      >
        {fullscreen ? (
          <Minimize size={20} strokeWidth={1.75} color={colors.ink} />
        ) : (
          <Maximize size={20} strokeWidth={1.75} color={colors.ink} />
        )}
      </Pressable>

      <Pressable
        onPress={onToggleSatellite}
        accessibilityLabel="Toggle map style"
        style={({ pressed }) => [s.satelliteBtn, raised && s.satelliteBtnRaised, pressed && s.pressed]}
      >
        <Text style={s.satelliteText}>{satellite ? 'Map' : 'Satellite'}</Text>
      </Pressable>

      <Pressable
        onPress={onLocate}
        disabled={locating}
        accessibilityLabel="Show my location"
        style={({ pressed }) => [s.roundBtn, s.locateBtn, raised && s.locateBtnRaised, pressed && s.pressed]}
      >
        <LocateFixed size={18} strokeWidth={2} color={locating ? colors.faint : colors.ink} />
      </Pressable>

      {poiSupported ? (
        <Pressable
          onPress={onTogglePoi}
          accessibilityLabel="Toggle map landmarks"
          accessibilityState={{ selected: poiEnabled }}
          style={({ pressed }) => [
            s.roundBtn,
            s.poiBtn,
            raised && s.poiBtnRaised,
            poiEnabled && s.poiBtnOn,
            pressed && s.pressed,
          ]}
        >
          <Landmark size={18} strokeWidth={2} color={poiEnabled ? colors.white : colors.ink} />
        </Pressable>
      ) : null}
    </>
  );
}

function LayerRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={({ pressed }) => [s.layerRow, pressed && { backgroundColor: colors.surface }]}
    >
      <Text style={s.layerLabel}>{label}</Text>
      <View style={[s.checkbox, value && s.checkboxOn]}>
        {value ? <Text style={s.check}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const lift = {
  shadowColor: '#1B1F1C',
  shadowOpacity: 0.12,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

const s = StyleSheet.create({
  pressed: { opacity: 0.8 },

  layersWrap: { position: 'absolute', left: 12, top: 12, zIndex: 3 },
  layersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...lift,
  },
  layersText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.ink },
  layersMenu: {
    marginTop: 8,
    width: 176,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 6,
    ...lift,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  layerLabel: { fontSize: 12, fontFamily: font.medium, color: colors.ink },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  check: { color: colors.white, fontSize: 10, lineHeight: 12, fontFamily: font.bold },

  roundBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...lift,
  },
  fullscreenBtn: { right: 12, top: 12 },
  locateBtn: { right: 12, bottom: 36 },
  locateBtnRaised: { bottom: 126 },
  poiBtn: { right: 12, bottom: 88 },
  poiBtnRaised: { bottom: 178 },
  poiBtnOn: { backgroundColor: colors.accent },

  satelliteBtnRaised: { bottom: 126 },
  satelliteBtn: {
    position: 'absolute',
    left: 12,
    bottom: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 2,
    ...lift,
  },
  satelliteText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.ink },
});
