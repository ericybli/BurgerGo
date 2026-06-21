/**
 * Assembled API client, namespaced by section. Reads are public GET; writes are
 * REST wrappers around the web app's Server Actions. Import `{ api }` and call
 * e.g. `api.trips.list()`, `api.budget.get(tripId)`, `api.packing.addItem(...)`.
 */
import { getJson, writeJson, postForm, photoUrl, API_BASE, CREDENTIALS } from './client';
import type {
  ImportPreviewItem,
  ImportCreateItem,
  Trip,
  Place,
  PlacesResponse,
  PlacePatch,
  Leg,
  TravelMode,
  Restaurant,
  RestaurantInput,
  BudgetResponse,
  Expense,
  ExpenseInput,
  BudgetTarget,
  BudgetCategory,
  PackingCategory,
  PackingItem,
  Task,
  JournalResponse,
  JournalEntry,
  SavedLink,
  JournalPhoto,
  Settings,
  Ticket,
  TicketInput,
  TicketFile,
  DayWeather,
  PoiDetails,
  AutocompletePrediction,
  GooglePlaceDetails,
  Me,
  TripMemberView,
} from './types';

const enc = encodeURIComponent;

export const api = {
  // --- Trips ---------------------------------------------------------------
  trips: {
    list: () => getJson<Trip[]>('/api/trips'),
    get: (tripId: string) =>
      getJson<{ trip: Trip; days: unknown[] }>(`/api/trips/${tripId}`),
    create: (body: { name: string; startDate: string; endDate: string }) =>
      writeJson<{ trip: Trip }>('POST', '/api/trips', body),
    update: (
      tripId: string,
      patch: Partial<{ name: string; startDate: string; coverPhoto: string | null }>,
    ) => writeJson<{ trip: Trip }>('PATCH', `/api/trips/${tripId}`, patch),
    remove: (tripId: string) => writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}`),
  },

  // --- Account / members -----------------------------------------------------
  me: {
    get: () => getJson<{ user: Me }>('/api/me'),
    updateName: (name: string) => writeJson<{ user: Me }>('PATCH', '/api/me', { name }),
    uploadAvatar: (file: { uri: string; name: string; type: string }) =>
      postForm<{ image: string }>('/api/me/avatar', {}, file),
  },
  members: {
    list: (tripId: string) => getJson<{ members: TripMemberView[] }>(`/api/trips/${tripId}/members`),
    invite: (tripId: string, email: string) =>
      writeJson<{ members: TripMemberView[] }>('POST', `/api/trips/${tripId}/members`, { email }),
    remove: (tripId: string, memberId: string) =>
      writeJson<{ members: TripMemberView[] }>('DELETE', `/api/trips/${tripId}/members/${enc(memberId)}`),
  },

  // --- Plan / places -------------------------------------------------------
  places: {
    /** `detail=full` so cards get photos + AI summary and the map gets route polylines. */
    list: (tripId: string) => getJson<PlacesResponse>(`/api/trips/${tripId}/places?detail=full`),
    create: (tripId: string, body: PlacePatch & { name: string; dayDate?: string | null }) =>
      writeJson<{ place: Place }>('POST', `/api/trips/${tripId}/places`, body),
    update: (tripId: string, placeId: string, patch: PlacePatch) =>
      writeJson<{ place: Place }>('PATCH', `/api/trips/${tripId}/places/${placeId}`, patch),
    remove: (tripId: string, placeId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/places/${placeId}`),
    /** Move to a day, or to Saved (dayDate=null); copy duplicates onto a day. */
    move: (tripId: string, placeId: string, dayDate: string | null, copy = false) =>
      writeJson<{ place: Place }>('POST', `/api/trips/${tripId}/places/${placeId}/move`, {
        dayDate,
        copy,
      }),
    reorder: (tripId: string, date: string, orderedIds: string[]) =>
      writeJson<{ ok: true }>('POST', `/api/trips/${tripId}/days/${date}/reorder`, { orderedIds }),
    setMode: (tripId: string, date: string, mode: TravelMode) =>
      writeJson<{ dayMode: { mode: TravelMode } }>('PUT', `/api/trips/${tripId}/days/${date}/mode`, {
        mode,
      }),
    recompute: (tripId: string, date: string, mode: TravelMode) =>
      writeJson<{ legs: unknown[] }>('POST', `/api/trips/${tripId}/days/${date}/recompute`, { mode }),
    /** Set (or clear, with null/empty) one day's itinerary title. */
    setDayTitle: (tripId: string, date: string, title: string | null) =>
      writeJson<{ ok: true }>('PUT', `/api/trips/${tripId}/days/${date}/title`, { title }),
  },

  // --- Saved-place lists -----------------------------------------------------
  savedLists: {
    add: (tripId: string, name: string) =>
      writeJson<{ list: { id: string; name: string } }>('POST', `/api/trips/${tripId}/lists`, { name }),
    rename: (tripId: string, listId: string, name: string) =>
      writeJson<{ ok: true }>('PATCH', `/api/trips/${tripId}/lists/${listId}`, { name }),
    remove: (tripId: string, listId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/lists/${listId}`),
  },

  // --- Weather (per trip day; null when no pinned coords / upstream down) ----
  weather: {
    day: (tripId: string, date: string) =>
      getJson<{ weather: DayWeather | null }>(`/api/trips/${tripId}/weather?date=${enc(date)}`),
  },

  // --- Google proxies (server key stays on the backend) -----------------------
  google: {
    autocomplete: (input: string, sessionToken?: string) =>
      getJson<{ predictions: AutocompletePrediction[] }>(
        `/api/google/autocomplete?input=${enc(input)}${sessionToken ? `&sessionToken=${enc(sessionToken)}` : ''}`,
      ),
    /** NOTE: the route returns the details object FLAT (no wrapper). */
    details: (placeId: string, sessionToken?: string) =>
      getJson<GooglePlaceDetails>(
        `/api/google/details?placeId=${enc(placeId)}${sessionToken ? `&sessionToken=${enc(sessionToken)}` : ''}`,
      ),
    /** Rich POI card data for a tapped basemap landmark. */
    poi: (placeId: string) => getJson<PoiDetails>(`/api/google/poi?placeId=${enc(placeId)}`),
    /** Streaming proxy URL for a POI photo reference. */
    poiPhotoUrl: (ref: string, width = 800) =>
      `${API_BASE}/api/google/poi-photo?ref=${enc(ref)}&w=${width}`,
  },

  // --- Tickets (reservations + original-byte attachments) --------------------
  tickets: {
    list: (tripId: string) => getJson<{ tickets: Ticket[] }>(`/api/trips/${tripId}/tickets`),
    create: (tripId: string, body: TicketInput) =>
      writeJson<{ ticket: Omit<Ticket, 'files'> }>('POST', `/api/trips/${tripId}/tickets`, body),
    update: (tripId: string, ticketId: string, patch: Partial<TicketInput>) =>
      writeJson<{ ticket: Omit<Ticket, 'files'> }>(
        'PATCH',
        `/api/trips/${tripId}/tickets/${ticketId}`,
        patch,
      ),
    remove: (tripId: string, ticketId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/tickets/${ticketId}`),
    /** Upload one attachment (image or PDF, ≤15 MB, ≤12 per ticket). */
    uploadFile: (
      tripId: string,
      ticketId: string,
      file: { uri: string; name: string; type: string },
    ) => postForm<{ file: TicketFile }>('/api/tickets/files', { tripId, ticketId }, file, 'file'),
    removeFile: (fileId: string) => writeJson<{ ok: true }>('DELETE', `/api/tickets/files/${fileId}`),
    /** Inline-view URL for an attachment (RFC 5987 filename on the response). */
    fileUrl: (fileId: string) => `${API_BASE}/api/tickets/files/${fileId}`,
  },

  // --- Eats / restaurants --------------------------------------------------
  eats: {
    list: (tripId: string) => getJson<{ restaurants: Restaurant[] }>(`/api/trips/${tripId}/restaurants`),
    create: (tripId: string, body: RestaurantInput) =>
      writeJson<{ restaurant: Restaurant }>('POST', `/api/trips/${tripId}/restaurants`, body),
    update: (tripId: string, restaurantId: string, patch: Partial<RestaurantInput>) =>
      writeJson<{ restaurant: Restaurant }>(
        'PATCH',
        `/api/trips/${tripId}/restaurants/${restaurantId}`,
        patch,
      ),
    remove: (tripId: string, restaurantId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/restaurants/${restaurantId}`),
    /** dayDate=null unschedules (removes the linked plan place). */
    schedule: (tripId: string, restaurantId: string, dayDate: string | null) =>
      writeJson<{ restaurant: Restaurant }>(
        'POST',
        `/api/trips/${tripId}/restaurants/${restaurantId}/schedule`,
        { dayDate },
      ),
  },

  // --- Budget --------------------------------------------------------------
  budget: {
    get: (tripId: string) => getJson<BudgetResponse>(`/api/trips/${tripId}/budget`),
    addExpense: (tripId: string, body: ExpenseInput) =>
      writeJson<{ expense: Expense }>('POST', `/api/trips/${tripId}/expenses`, body),
    updateExpense: (tripId: string, expenseId: string, patch: Partial<ExpenseInput>) =>
      writeJson<{ expense: Expense }>('PATCH', `/api/trips/${tripId}/expenses/${expenseId}`, patch),
    deleteExpense: (tripId: string, expenseId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/expenses/${expenseId}`),
    setTarget: (tripId: string, category: BudgetCategory | null, plannedAmount: number) =>
      writeJson<{ target: BudgetTarget }>('PUT', `/api/trips/${tripId}/budget/targets`, {
        category,
        plannedAmount,
      }),
    clearTarget: (tripId: string, category: BudgetCategory | null) =>
      writeJson<{ ok: true }>(
        'DELETE',
        `/api/trips/${tripId}/budget/targets${category ? `?category=${enc(category)}` : ''}`,
      ),
  },

  // --- Packing (To do) -----------------------------------------------------
  packing: {
    list: (tripId: string) => getJson<{ categories: PackingCategory[] }>(`/api/trips/${tripId}/packing`),
    addCategory: (tripId: string, name: string) =>
      writeJson<{ category: PackingCategory }>('POST', `/api/trips/${tripId}/packing/categories`, {
        name,
      }),
    renameCategory: (tripId: string, categoryId: string, name: string) =>
      writeJson<{ category: PackingCategory }>(
        'PATCH',
        `/api/trips/${tripId}/packing/categories/${categoryId}`,
        { name },
      ),
    deleteCategory: (tripId: string, categoryId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/packing/categories/${categoryId}`),
    addItem: (tripId: string, categoryId: string, name: string, quantity?: number) =>
      writeJson<{ item: PackingItem }>('POST', `/api/trips/${tripId}/packing/items`, {
        categoryId,
        name,
        ...(quantity !== undefined ? { quantity } : {}),
      }),
    updateItem: (
      tripId: string,
      itemId: string,
      patch: Partial<{ name: string; quantity: number; packed: boolean }>,
    ) => writeJson<{ item: PackingItem }>('PATCH', `/api/trips/${tripId}/packing/items/${itemId}`, patch),
    deleteItem: (tripId: string, itemId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/packing/items/${itemId}`),
  },

  // --- Tasks (To do) -------------------------------------------------------
  tasks: {
    list: (tripId: string) => getJson<{ tasks: Task[] }>(`/api/trips/${tripId}/tasks`),
    create: (tripId: string, title: string) =>
      writeJson<{ task: Task }>('POST', `/api/trips/${tripId}/tasks`, { title }),
    update: (
      tripId: string,
      taskId: string,
      patch: Partial<{ title: string; note: string | null; done: boolean }>,
    ) => writeJson<{ task: Task }>('PATCH', `/api/trips/${tripId}/tasks/${taskId}`, patch),
    remove: (tripId: string, taskId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/tasks/${taskId}`),
  },

  // --- Journal (entries + reading-list links) ------------------------------
  journal: {
    get: (tripId: string) => getJson<JournalResponse>(`/api/trips/${tripId}/journal`),
    addEntry: (tripId: string, body: { title: string; body?: string; entryDate?: string | null }) =>
      writeJson<{ entry: JournalEntry }>('POST', `/api/trips/${tripId}/journal`, body),
    updateEntry: (
      tripId: string,
      entryId: string,
      patch: Partial<{ title: string; body: string; entryDate: string | null }>,
    ) => writeJson<{ entry: JournalEntry }>('PATCH', `/api/trips/${tripId}/journal/${entryId}`, patch),
    deleteEntry: (tripId: string, entryId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/journal/${entryId}`),
    addLink: (
      tripId: string,
      body: { url: string; title?: string | null; note?: string | null; thumbnail?: string | null },
    ) => writeJson<{ link: SavedLink }>('POST', `/api/trips/${tripId}/links`, body),
    updateLink: (
      tripId: string,
      linkId: string,
      patch: Partial<{ url: string; title: string | null; note: string | null; thumbnail: string | null }>,
    ) => writeJson<{ link: SavedLink }>('PATCH', `/api/trips/${tripId}/links/${linkId}`, patch),
    deleteLink: (tripId: string, linkId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/links/${linkId}`),
    /** Best-effort OG-preview; returns {} when nothing found. */
    linkPreview: (tripId: string, url: string) =>
      writeJson<{ title?: string; thumbnailPath?: string }>('POST', '/api/links/preview', { url, tripId }),
  },

  // --- Photos (shared) -----------------------------------------------------
  photos: {
    upload: (
      tripId: string,
      ownerType: 'journal' | 'restaurant' | 'place' | 'trip' | 'photo_list',
      ownerId: string,
      file: { uri: string; name: string; type: string },
    ) => postForm<{ photo: JournalPhoto }>('/api/photos', { tripId, ownerType, ownerId }, file),
    remove: (photoId: string) => writeJson<{ ok: true }>('DELETE', `/api/photos/p/${photoId}`),
  },

  // --- Photography lists (Journal) ------------------------------------------
  photoLists: {
    add: (tripId: string, name: string) =>
      writeJson<{ list: { id: string; name: string } }>('POST', `/api/trips/${tripId}/photo-lists`, { name }),
    rename: (tripId: string, listId: string, name: string) =>
      writeJson<{ ok: true }>('PATCH', `/api/trips/${tripId}/photo-lists/${listId}`, { name }),
    remove: (tripId: string, listId: string) =>
      writeJson<{ ok: true }>('DELETE', `/api/trips/${tripId}/photo-lists/${listId}`),
  },

  // --- AI import (extract via OpenAI on the server, then create confirmed) --
  aiImport: {
    /** images = data:image/... URLs (max ~4); text ≤ 20k chars. Online-only. */
    extract: (tripId: string, body: { images: string[]; text: string }) =>
      writeJson<{ items: ImportPreviewItem[] }>('POST', `/api/trips/${tripId}/ai-import/extract`, body),
    create: (tripId: string, items: ImportCreateItem[]) =>
      writeJson<{ restaurants: number; places: number }>(
        'POST',
        `/api/trips/${tripId}/ai-import/create`,
        { items },
      ),
  },

  // --- Settings (global) ---------------------------------------------------
  settings: {
    get: () => getJson<Settings | null>('/api/settings'),
    update: (patch: Partial<{ currency: string; prompt: string | null; model: string | null }>) =>
      writeJson<{ settings: Settings | null }>('PATCH', '/api/settings', patch),
  },
};

export { API_BASE, photoUrl, CREDENTIALS };
export type {
  Trip,
  Place,
  PlacesResponse,
  PlacePatch,
  Leg,
  TravelMode,
  Restaurant,
  RestaurantInput,
  RestaurantStatus,
  RestaurantPhoto,
  BudgetResponse,
  Expense,
  ExpenseInput,
  BudgetTarget,
  BudgetCategory,
  PlaceOption,
  PackingCategory,
  PackingItem,
  Task,
  JournalResponse,
  JournalEntry,
  SavedLink,
  JournalPhoto,
  PhotoList,
  Settings,
  Ticket,
  TicketInput,
  TicketFile,
  DayWeather,
  PoiDetails,
  PoiReview,
  AutocompletePrediction,
  GooglePlaceDetails,
  ImportPreviewItem,
  ImportCreateItem,
  Me,
  TripMemberView,
} from './types';
