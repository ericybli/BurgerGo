import { SettingsClient } from '@/components/SettingsClient';

// Static app shell: no server-side DB read so the SW can cache the page document.
// SettingsClient fetches `/api/settings` (SWR-cached) on mount. (§7.3/§8.2)
export default function SettingsPage() {
  return <SettingsClient />;
}
