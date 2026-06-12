'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import {
  listMembersAction,
  inviteMemberAction,
  removeMemberAction,
} from '@/app/_actions/members';
import type { MemberView } from '@/src/db/repos/tripMembers';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trip roster + invite-by-email. Owner removes others; members can leave. */
export function MembersSection({ tripId }: { tripId: string }) {
  const t = useTranslations('members');
  const [members, setMembers] = useState<MemberView[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listMembersAction(tripId)
      .then((v) => { if (!cancelled) setMembers(v); })
      .catch(() => { if (!cancelled) setMembers([]); });
    void fetch(withBase('/api/me'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { user: { id: string } } | null) => { if (!cancelled) setMeId(j?.user.id ?? null); })
      .catch(() => { if (!cancelled) setMeId(null); });
    return () => { cancelled = true; };
  }, [tripId]);

  const mine = members?.find((m) => m.userId != null && m.userId === meId);
  const amOwner = mine?.role === 'owner';

  async function run(fn: () => Promise<MemberView[]>) {
    setBusy(true);
    setError(false);
    try {
      setMembers(await fn());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!members) return null;

  return (
    <>
      <p className="mt-6 text-heading text-ink">
        {t('title')} <span className="font-normal text-sub">({members.length})</span>
      </p>
      <ul className="mt-2 space-y-2">
        {members.map((m) => {
          const canRemove =
            m.role !== 'owner' && (amOwner || (meId != null && m.userId === meId));
          const isSelf = meId != null && m.userId === meId;
          return (
            <li key={m.id} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-[13px] font-semibold text-sub">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBase(m.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  (m.name ?? m.invitedEmail).slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">
                  {m.name ?? m.invitedEmail}
                  {isSelf ? <span className="text-sub"> {t('you')}</span> : null}
                </span>
                {m.userId == null ? (
                  <span className="block text-caption text-faint">{t('pending')}</span>
                ) : null}
              </span>
              {m.role === 'owner' ? (
                <span className="rounded-chip border border-line px-2 py-0.5 text-caption text-sub">{t('owner')}</span>
              ) : canRemove ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => removeMemberAction(tripId, m.id))}
                  className="rounded-control px-2 py-1 text-caption font-medium text-danger active:opacity-70 disabled:opacity-40"
                >
                  {isSelf ? t('leave') : t('remove')}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          disabled={busy}
          placeholder={t('emailPlaceholder')}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || !EMAIL_RE.test(email.trim())}
          onClick={() =>
            void run(async () => {
              const next = await inviteMemberAction(tripId, email.trim());
              setEmail('');
              return next;
            })
          }
          className="shrink-0 rounded-control bg-orange px-3 py-2 text-label text-white transition hover:bg-orange-press disabled:bg-surface disabled:text-faint"
        >
          {t('invite')}
        </button>
      </div>
      <p className="mt-1 text-caption text-sub">{t('hint')}</p>
      {error ? <p role="alert" className="mt-1 text-caption font-medium text-danger">{t('error')}</p> : null}
    </>
  );
}
