/** Backend origin (+ sub-path). Env-overridable for local backend debugging. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'https://eric.month2month.com/burgergo';
