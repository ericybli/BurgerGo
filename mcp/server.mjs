#!/usr/bin/env node
/**
 * BurgerGo MCP server.
 *
 * Lets an AI client query trips (days, places, restaurants, saved places) and
 * add restaurants / saved places (name, address, about, notes, image) to a trip.
 *
 * It talks to the BurgerGo HTTP API over the network — so it reads/writes the
 * SAME data the live app uses. Configure with env vars:
 *   BURGERGO_BASE_URL  base URL incl. sub-path (default the production host)
 *   BURGERGO_API_KEY   sent as `x-api-key` on writes (required only if the
 *                      server has BURGERGO_API_KEY set)
 *
 * Reads use the public GET endpoints; writes use POST /api/trips/:id/{places,
 * restaurants}. Images are downloaded here (on the trusted client) and uploaded
 * via the existing multipart POST /api/photos — the server never fetches an
 * arbitrary URL.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.BURGERGO_BASE_URL || 'https://eric.month2month.com/burgergo').replace(/\/+$/, '');
const API_KEY = process.env.BURGERGO_API_KEY || '';

/** GET JSON from the BurgerGo API. */
async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

/** POST JSON to the BurgerGo API (adds the write API key when configured). */
async function apiPost(path, body) {
  const headers = { 'content-type': 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

/**
 * Download an image URL here and upload it to the place/restaurant via the
 * existing multipart photo endpoint. Best-effort: returns a short status string.
 */
async function uploadPhoto({ tripId, ownerType, ownerId, imageUrl }) {
  const img = await fetch(imageUrl);
  if (!img.ok) return `photo skipped (download ${img.status})`;
  const buf = Buffer.from(await img.arrayBuffer());
  const contentType = img.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) return 'photo skipped (not an image)';
  const fd = new FormData();
  fd.set('image', new Blob([buf], { type: contentType }), 'photo');
  fd.set('tripId', tripId);
  fd.set('ownerType', ownerType);
  fd.set('ownerId', ownerId);
  const res = await fetch(`${BASE_URL}/api/photos`, { method: 'POST', body: fd });
  return res.ok ? 'photo uploaded' : `photo failed (${res.status})`;
}

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function fail(message) {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({ name: 'burgergo', version: '1.0.0' });

server.tool(
  'list_trips',
  'List all BurgerGo trips (id, name, date range).',
  async () => {
    try {
      const trips = await apiGet('/api/trips'); // bare array
      const list = Array.isArray(trips) ? trips : [];
      return ok(list.map((t) => ({ id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate })));
    } catch (e) {
      return fail(String(e.message ?? e));
    }
  },
);

server.tool(
  'get_trip',
  'Get a trip overview: its day-by-day places, saved (wishlist) places, and restaurants.',
  { tripId: z.string().describe('Trip id from list_trips') },
  async ({ tripId }) => {
    try {
      const [{ trip }, placesRes, restaurantsRes] = await Promise.all([
        apiGet(`/api/trips/${tripId}`),
        apiGet(`/api/trips/${tripId}/places`),
        apiGet(`/api/trips/${tripId}/restaurants`),
      ]);
      const places = placesRes.places ?? [];
      const byDay = {};
      const saved = [];
      for (const p of places) {
        const slim = { id: p.id, name: p.name, address: p.address, about: p.aiSummary, notes: p.notes, scheduledTime: p.scheduledTime, category: p.category };
        if (p.dayDate === null) saved.push(slim);
        else (byDay[p.dayDate] ??= []).push(slim);
      }
      const days = Object.keys(byDay).sort().map((date) => ({ date, places: byDay[date] }));
      const restaurants = (restaurantsRes.restaurants ?? []).map((r) => ({
        id: r.id, name: r.name, cuisine: r.cuisine, address: r.address, notes: r.notes,
        status: r.status, rating: r.rating, scheduledDayDate: r.scheduledDayDate,
      }));
      return ok({ trip: { id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate }, days, savedPlaces: saved, restaurants });
    } catch (e) {
      return fail(String(e.message ?? e));
    }
  },
);

server.tool(
  'add_saved_place',
  'Add a Saved (wishlist) place to a trip. The address is geocoded so it maps. Optionally attach a photo by URL.',
  {
    tripId: z.string(),
    name: z.string().describe('Place name'),
    address: z.string().optional().describe('Street address or place location; geocoded for the map'),
    about: z.string().optional().describe('A description / intro (stored as the place’s About)'),
    notes: z.string().optional().describe('Personal notes'),
    imageUrl: z.string().url().optional().describe('Image URL to attach as the place photo'),
  },
  async ({ tripId, name, address, about, notes, imageUrl }) => {
    try {
      const { place } = await apiPost(`/api/trips/${tripId}/places`, { name, address, about, notes });
      let photo = 'no photo';
      if (imageUrl) photo = await uploadPhoto({ tripId, ownerType: 'place', ownerId: place.id, imageUrl });
      return ok({ created: { id: place.id, name: place.name, address: place.address, lat: place.lat, lng: place.lng }, photo });
    } catch (e) {
      return fail(String(e.message ?? e));
    }
  },
);

server.tool(
  'add_restaurant',
  'Add a restaurant to a trip. The address is geocoded so it pins on the map. Optionally attach a photo by URL.',
  {
    tripId: z.string(),
    name: z.string().describe('Restaurant name'),
    address: z.string().optional().describe('Address; geocoded for the map'),
    about: z.string().optional().describe('A description (folded into notes)'),
    notes: z.string().optional().describe('Personal notes'),
    cuisine: z.string().optional(),
    status: z.enum(['want-to-try', 'been']).optional().describe('Defaults to want-to-try'),
    imageUrl: z.string().url().optional().describe('Image URL to attach as the restaurant photo'),
  },
  async ({ tripId, name, address, about, notes, cuisine, status, imageUrl }) => {
    try {
      const { restaurant } = await apiPost(`/api/trips/${tripId}/restaurants`, { name, address, about, notes, cuisine, status });
      let photo = 'no photo';
      if (imageUrl) photo = await uploadPhoto({ tripId, ownerType: 'restaurant', ownerId: restaurant.id, imageUrl });
      return ok({ created: { id: restaurant.id, name: restaurant.name, cuisine: restaurant.cuisine, status: restaurant.status }, photo });
    } catch (e) {
      return fail(String(e.message ?? e));
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
