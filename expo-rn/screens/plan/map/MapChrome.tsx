/**
 * Floating Atlas controls over the map canvas (shared by both platforms):
 * Layers pill + menu (top-left, days bucket), fullscreen (top-right),
 * satellite pill (bottom-left), locate + POI toggle (bottom-right). All of
 * them are liquid-glass plates (they float over imagery — chrome is always
 * glass); the active POI state is teal tinted glass.
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
import { GlassPlate, GlassTintPlate } from '../../../components/ui/glass';

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
            style={({ pressed }) => (pressed ? s.pressed : null)}
          >
            <GlassPlate radius={999} style={s.layersBtn}>
              <Layers size={16} strokeWidth={1.75} color={colors.ink} />
              <Text style={s.layersText}>Layers</Text>
            </GlassPlate>
          </Pressable>
          {layersOpen ? (
            <GlassPlate radius={14} strength="sheet" style={s.layersMenu}>
              <LayerRow label="Routes" value={showRoutes} onToggle={onToggleRoutes} />
              <LayerRow label="Saved places" value={showSaved} onToggle={onToggleSaved} />
              <LayerRow label="Restaurants" value={showRestaurants} onToggle={onToggleRestaurants} />
            </GlassPlate>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={onToggleFullscreen}
        accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        style={({ pressed }) => [s.float, s.fullscreenBtn, pressed ? s.pressed : null]}
      >
        <GlassPlate radius={999} style={s.roundBtn}>
          {fullscreen ? (
            <Minimize size={20} strokeWidth={1.75} color={colors.ink} />
          ) : (
            <Maximize size={20} strokeWidth={1.75} color={colors.ink} />
          )}
        </GlassPlate>
      </Pressable>

      <Pressable
        onPress={onToggleSatellite}
        accessibilityLabel="Toggle map style"
        style={({ pressed }) => [
          s.float,
          s.satelliteBtn,
          raised && s.satelliteBtnRaised,
          pressed ? s.pressed : null,
        ]}
      >
        <GlassPlate radius={999} style={s.satellitePill}>
          <Text style={s.satelliteText}>{satellite ? 'Map' : 'Satellite'}</Text>
        </GlassPlate>
      </Pressable>

      <Pressable
        onPress={onLocate}
        disabled={locating}
        accessibilityLabel="Show my location"
        style={({ pressed }) => [
          s.float,
          s.locateBtn,
          raised && s.locateBtnRaised,
          pressed ? s.pressed : null,
        ]}
      >
        <GlassPlate radius={999} style={s.roundBtn}>
          <LocateFixed size={18} strokeWidth={2} color={locating ? colors.faint : colors.ink} />
        </GlassPlate>
      </Pressable>

      {poiSupported ? (
        <Pressable
          onPress={onTogglePoi}
          accessibilityLabel="Toggle map landmarks"
          accessibilityState={{ selected: poiEnabled }}
          style={({ pressed }) => [
            s.float,
            s.poiBtn,
            raised && s.poiBtnRaised,
            pressed ? s.pressed : null,
          ]}
        >
          {poiEnabled ? (
            /* Active = teal tinted glass (handoff: accent state keeps color). */
            <GlassTintPlate radius={999} color="rgba(51,103,122,0.85)" style={s.roundBtn}>
              <Landmark size={18} strokeWidth={2} color={colors.white} />
            </GlassTintPlate>
          ) : (
            <GlassPlate radius={999} style={s.roundBtn}>
              <Landmark size={18} strokeWidth={2} color={colors.ink} />
            </GlassPlate>
          )}
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

const s = StyleSheet.create({
  pressed: { opacity: 0.8 },

  /** Absolute anchors live on the Pressables; the glass plates fill inside. */
  float: { position: 'absolute', zIndex: 2 },

  layersWrap: { position: 'absolute', left: 12, top: 12, zIndex: 3 },
  layersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
  },
  layersText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.ink },
  layersMenu: {
    marginTop: 8,
    width: 176,
    padding: 6,
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenBtn: { right: 12, top: 12 },
  locateBtn: { right: 12, bottom: 36 },
  locateBtnRaised: { bottom: 126 },
  poiBtn: { right: 12, bottom: 88 },
  poiBtnRaised: { bottom: 178 },

  satelliteBtnRaised: { bottom: 126 },
  satelliteBtn: { left: 12, bottom: 36 },
  satellitePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  satelliteText: { fontSize: 12.5, fontFamily: font.semibold, color: colors.ink },
});
