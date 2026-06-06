import { env } from '@/src/env';
import { HomeClient } from '@/components/HomeClient';

// Static app shell: no server-side DB read, so the SW can cache the page document.
// HomeClient owns the data and fetches `/api/trips` (SWR-cached) on mount. (§7.3/§8.2)
export default function HomePage() {
  return <HomeClient tz={env.TZ} />;
}
