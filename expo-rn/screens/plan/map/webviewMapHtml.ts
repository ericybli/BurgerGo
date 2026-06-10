/**
 * Self-contained HTML document for the iOS Google-Maps-JS map canvas
 * (GoogleWebCanvas renders it inside a react-native-webview). Everything in
 * the page is plain JS — no imports, no TS — talking JSON to the RN side:
 *
 *   RN → page (window.__bgDispatch via injectJavaScript):
 *     {type:'SET_DATA', pins, segs, fitKey, fitCoords}  full overlay state
 *     {type:'SET_MAPTYPE', satellite}                   roadmap ↔ hybrid
 *     {type:'SET_POI', enabled}                         clickableIcons toggle
 *     {type:'SET_USER_LOC', lat, lng, pan}              blue dot (+locate pan)
 *     {type:'SET_CAMERA', lat, lng, zoom}               explicit restore
 *
 *   page → RN (window.ReactNativeWebView.postMessage):
 *     {type:'READY'}                 map constructed; RN flushes its queue
 *     {type:'PIN_TAP', key}          pin tapped (RN resolves MapPin by key)
 *     {type:'LEG_TAP', key}          hit polyline tapped
 *     {type:'POI_TAP', placeId}      basemap POI tapped (only when POI on)
 *     {type:'MAP_TAP'}               plain map tap (dismiss chip/menu)
 *     {type:'REGION', lat, lng, zoom} on idle — RN persists for remounts
 *     {type:'ERROR'}                 Maps JS failed to load
 *
 * The pin DOM is a 1:1 port of markerDom.ts (white disc, 2px day-color ring,
 * glyph, stop badge, time pill) hosted in an OverlayView subclass; walk legs
 * are circle-symbol dotted lines; drive/transit solid. fitBounds runs ONCE
 * per distinct fitKey — the initial key (and camera) are baked in from the
 * persisted values so a WebView remount restores the view without refitting.
 */

export type WebCanvasCamera = { lat: number; lng: number; zoom: number };

/** `</`-safe JSON for inline <script> embedding. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildMapHtml(opts: {
  apiKey: string;
  /** Camera restored across WebView remounts (null = world view until fit). */
  camera: WebCanvasCamera | null;
  /** Last applied fit key, so the post-remount SET_DATA doesn't refit. */
  fitKey: string;
}): string {
  const src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(opts.apiKey)}&loading=async&callback=__bgInit`;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { height: 100%; margin: 0; padding: 0; background: #F4F5F2; overflow: hidden; }
  #map { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
  button:focus { outline: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
'use strict';

/* ---- Values baked in by the RN side (restored across WebView remounts) ---- */
var INIT_CAMERA = ${inlineJson(opts.camera)};
var INIT_FIT_KEY = ${inlineJson(opts.fitKey)};

var map = null;
var overlays = [];                 /* pins + polylines, cleared per SET_DATA */
var userDot = null;                /* blue-dot overlay; survives redraws */
var lastFitKey = INIT_FIT_KEY || '';
var poiEnabled = false;
var DomOverlay = null;             /* OverlayView subclass, defined on init */
var pending = [];                  /* RN messages that beat map creation */

function post(msg) {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  } else if (window.console && window.console.log) {
    window.console.log('[bgmap]', JSON.stringify(msg)); /* desktop smoke test */
  }
}

/* RN → page entry point (called via injectJavaScript). */
window.__bgDispatch = function (msg) {
  if (!map) { pending.push(msg); return; }
  handleMessage(msg);
};

window.__bgLoadError = function () { post({ type: 'ERROR' }); };

function handleMessage(msg) {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case 'SET_DATA':
      applyData(msg);
      break;
    case 'SET_MAPTYPE':
      map.setMapTypeId(msg.satellite ? 'hybrid' : 'roadmap');
      break;
    case 'SET_POI':
      poiEnabled = !!msg.enabled;
      map.setOptions({ clickableIcons: poiEnabled });
      break;
    case 'SET_USER_LOC':
      setUserLoc(msg);
      break;
    case 'SET_CAMERA':
      map.setCenter({ lat: msg.lat, lng: msg.lng });
      map.setZoom(msg.zoom);
      break;
  }
}

/* Clear + redraw all overlays; fit ONCE per distinct fitKey. */
function applyData(msg) {
  var i;
  for (i = 0; i < overlays.length; i++) overlays[i].setMap(null);
  overlays = [];

  var segs = msg.segs || [];
  for (i = 0; i < segs.length; i++) addSeg(segs[i]);

  var pins = msg.pins || [];
  for (i = 0; i < pins.length; i++) addPin(pins[i]);

  if (msg.fitKey && msg.fitKey !== lastFitKey) {
    lastFitKey = msg.fitKey;
    var coords = msg.fitCoords || [];
    if (coords.length > 0) {
      var bounds = new google.maps.LatLngBounds();
      for (i = 0; i < coords.length; i++) bounds.extend(coords[i]);
      map.fitBounds(bounds, { top: 64, right: 48, bottom: 64, left: 48 });
    }
  }
}

/* Visible route line (walk = circle-symbol dots; drive/transit solid) plus a
   WIDE invisible hit line so a finger tap reliably lands → LEG_TAP. */
function addSeg(seg) {
  if (!seg.path || seg.path.length < 2) return;
  var isWalk = seg.mode === 'walk';
  var lineOpts = {
    path: seg.path,
    strokeColor: seg.color,
    strokeOpacity: isWalk ? 0 : 0.9,
    strokeWeight: 3,
    clickable: false,
    map: map,
  };
  if (isWalk) {
    lineOpts.icons = [
      {
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: seg.color,
          fillOpacity: 0.9,
          strokeOpacity: 0,
          scale: 1.6,
        },
        offset: '0',
        repeat: '10px',
      },
    ];
  }
  overlays.push(new google.maps.Polyline(lineOpts));

  var hit = new google.maps.Polyline({
    path: seg.path,
    strokeColor: seg.color,
    strokeOpacity: 0.001, /* invisible but clickable */
    strokeWeight: 16,
    map: map,
  });
  hit.addListener('click', function () {
    post({ type: 'LEG_TAP', key: seg.key });
  });
  overlays.push(hit);
}

function addPin(pin) {
  var el = buildPinEl(pin, function () {
    post({ type: 'PIN_TAP', key: pin.key });
  });
  var ov = new DomOverlay(pin.lat, pin.lng, el, 'overlayMouseTarget');
  ov.setMap(map);
  overlays.push(ov);
}

function setUserLoc(msg) {
  if (userDot) {
    userDot.move(msg.lat, msg.lng);
  } else {
    userDot = new DomOverlay(msg.lat, msg.lng, buildUserDotEl(), 'floatPane');
    userDot.setMap(map);
  }
  if (msg.pan) {
    /* Locate behavior: pan to the fix; zoom 14 ≈ delta 0.02, only if lower. */
    map.panTo({ lat: msg.lat, lng: msg.lng });
    var z = map.getZoom();
    if (typeof z === 'number' && z < 14) map.setZoom(14);
  }
}

/* ---- Pin DOM: 1:1 port of markerDom.ts (Instrument Sans isn't loaded in
   the WebView, so the badge/pill fall back to the system UI font). ---- */
var PIN_FONT = "system-ui, -apple-system, 'Helvetica Neue', sans-serif";

function buildPinEl(pin, onClick) {
  var isDay = pin.label != null;
  var tone = pin.color;
  var size = isDay ? 34 : 28;

  var el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', pin.name || '');
  el.style.cssText =
    'position:absolute;width:0;height:0;padding:0;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent';

  /* Atlas pin: white disc, 2px day-color ring, category glyph centered. */
  var disc = document.createElement('span');
  disc.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'transform:translate(-50%,-50%)',
    'box-sizing:border-box',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'border:2px solid ' + tone,
    'border-radius:9999px',
    'box-shadow:0 2px 6px rgba(27,31,28,0.18)',
    'line-height:1',
    'width:' + size + 'px',
    'height:' + size + 'px',
    'background-color:#fff',
    'color:' + tone,
  ].join(';');

  var glyphEl = document.createElement('span');
  glyphEl.textContent = pin.glyph;
  glyphEl.setAttribute('aria-hidden', 'true');
  glyphEl.style.cssText = 'pointer-events:none;font-size:15px;line-height:1';
  disc.appendChild(glyphEl);

  if (isDay) {
    /* Stop-number badge: day-color disc, white number, white ring. */
    var badge = document.createElement('span');
    badge.textContent = pin.label;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:absolute',
      'top:-6px',
      'right:-6px',
      'min-width:16px',
      'height:16px',
      'padding:0 4px',
      'box-sizing:border-box',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:9999px',
      'border:1.5px solid #fff',
      'background:' + tone,
      'color:#fff',
      'font-size:9.5px',
      'font-weight:700',
      'font-family:' + PIN_FONT,
      'line-height:1',
    ].join(';');
    disc.appendChild(badge);
  }

  el.appendChild(disc);

  if (isDay && pin.scheduledTime) {
    /* Time chip under the pin: white pill, hairline border, tabular digits. */
    var time = document.createElement('span');
    time.textContent = pin.scheduledTime;
    time.setAttribute('aria-hidden', 'true');
    time.style.cssText = [
      'position:absolute',
      'top:' + (size / 2 + 3) + 'px',
      'left:0',
      'transform:translateX(-50%)',
      'padding:1px 6px',
      'border-radius:6px',
      'border:1px solid #E9EBE6',
      'background:#fff',
      'color:#1B1F1C',
      'font-size:10px',
      'font-weight:700',
      'font-family:' + PIN_FONT,
      'font-variant-numeric:tabular-nums',
      'line-height:1.2',
      'white-space:nowrap',
      'box-shadow:0 1px 3px rgba(27,31,28,0.12)',
    ].join(';');
    el.appendChild(time);
  }

  el.addEventListener('click', function (e) {
    e.stopPropagation();
    onClick();
  });
  return el;
}

/* Blue location dot, same ring/dot spec as the native canvas Marker. */
function buildUserDotEl() {
  var ring = document.createElement('div');
  ring.style.cssText =
    'position:absolute;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:11px;background:rgba(66,133,244,0.25);display:flex;align-items:center;justify-content:center;pointer-events:none';
  var dot = document.createElement('div');
  dot.style.cssText =
    'width:14px;height:14px;border-radius:7px;background:#4285F4;border:2.5px solid #fff;box-sizing:border-box';
  ring.appendChild(dot);
  return ring;
}

/* ---- Maps JS loader callback ---- */
window.__bgInit = function () {
  /* DOM node anchored at a lat/lng in a chosen pane. Pins ride
     overlayMouseTarget (tappable); the user dot rides floatPane (topmost,
     pointer-events:none). */
  DomOverlay = class extends google.maps.OverlayView {
    constructor(lat, lng, el, pane) {
      super();
      this.lat = lat;
      this.lng = lng;
      this.el = el;
      this.pane = pane;
    }
    onAdd() {
      var panes = this.getPanes();
      if (panes) panes[this.pane].appendChild(this.el);
    }
    draw() {
      var proj = this.getProjection();
      if (!proj) return;
      var pt = proj.fromLatLngToDivPixel(new google.maps.LatLng(this.lat, this.lng));
      if (pt) {
        this.el.style.left = pt.x + 'px';
        this.el.style.top = pt.y + 'px';
      }
    }
    onRemove() {
      this.el.remove();
    }
    move(lat, lng) {
      this.lat = lat;
      this.lng = lng;
      if (this.getProjection()) this.draw();
    }
  };

  map = new google.maps.Map(document.getElementById('map'), {
    center: INIT_CAMERA ? { lat: INIT_CAMERA.lat, lng: INIT_CAMERA.lng } : { lat: 20, lng: 0 },
    zoom: INIT_CAMERA ? INIT_CAMERA.zoom : 2,
    /* No native Google chrome; the app draws its own Atlas controls. */
    disableDefaultUI: true,
    /* Toggled at runtime by SET_POI. */
    clickableIcons: false,
    gestureHandling: 'greedy',
  });

  /* Basemap-POI taps (clickableIcons on): the click carries the landmark's
     placeId — suppress Google's info window, tell RN. Plain taps → MAP_TAP. */
  map.addListener('click', function (e) {
    if (e && e.placeId) {
      if (!poiEnabled) return;
      e.stop();
      post({ type: 'POI_TAP', placeId: e.placeId });
      return;
    }
    post({ type: 'MAP_TAP' });
  });

  /* Camera persistence: RN stores the latest region and bakes it into the
     next HTML build (fullscreen Modal remount). */
  map.addListener('idle', function () {
    var c = map.getCenter();
    var z = map.getZoom();
    if (c && typeof z === 'number') {
      post({ type: 'REGION', lat: c.lat(), lng: c.lng(), zoom: z });
    }
  });

  var queued = pending;
  pending = [];
  for (var i = 0; i < queued.length; i++) handleMessage(queued[i]);
  post({ type: 'READY' });
};
</script>
<script async src="${src}" onerror="window.__bgLoadError()"></script>
</body>
</html>`;
}
