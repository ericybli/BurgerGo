'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/lib/authClient';
import { withBase } from '@/src/lib/basePath';

type Me = { id: string; name: string; email: string; image: string | null };

/** Settings ▸ Profile: avatar (tap to replace), display name, email, sign out. */
export function ProfileCard() {
  const t = useTranslations('profile');
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch(withBase('/api/me'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user: Me } | null) => {
        if (j?.user) {
          setMe(j.user);
          setName(j.user.name);
        }
      })
      .catch(() => {
        // Offline or unauthenticated — stay hidden (me remains null).
      });
  }, []);

  async function saveName() {
    setBusy(true);
    setStatus(null);
    const res = await fetch(withBase('/api/me'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const j = (await res.json()) as { user: Me };
      setMe(j.user);
      setStatus(t('saved'));
    } else setStatus(t('saveError'));
    setBusy(false);
  }

  async function changeAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setStatus(null);
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(withBase('/api/me/avatar'), { method: 'POST', body: form });
    if (res.ok) {
      const j = (await res.json()) as { image: string };
      setMe((m) => (m ? { ...m, image: j.image } : m));
      setStatus(t('saved'));
    } else setStatus(t('saveError'));
    setBusy(false);
  }

  async function signOut() {
    await authClient.signOut();
    router.push(withBase('/login'));
    router.refresh();
  }

  if (!me) return null;

  return (
    <section className="mt-2 rounded-card border border-line bg-bg p-4">
      <h2 className="text-heading text-ink">{t('title')}</h2>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-line bg-surface"
          aria-label={t('changeAvatar')}
        >
          {me.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={withBase(me.image)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[20px] font-semibold text-sub">{me.name.slice(0, 1).toUpperCase()}</span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => void changeAvatar(e)} className="sr-only" />
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <input
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-control border border-line bg-bg px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || name.trim() === '' || name.trim() === me.name}
              onClick={() => void saveName()}
              className="shrink-0 rounded-control border border-line bg-bg px-3 py-2 text-label text-accent transition hover:bg-accent-tint disabled:opacity-40"
            >
              {t('save')}
            </button>
          </div>
          <p className="mt-1 truncate text-caption text-sub">{me.email}</p>
        </div>
      </div>
      {status ? <p className="mt-2 text-caption font-medium text-accent">{status}</p> : null}
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 rounded-control px-3 py-2 text-label text-danger transition active:opacity-70"
      >
        {t('signOut')}
      </button>
    </section>
  );
}
