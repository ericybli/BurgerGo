/**
 * Trip roster + invite-by-email (web components/MembersSection.tsx): the owner
 * can remove anyone but themselves; members can leave; invited emails show as
 * pending rows until that Google account signs in. Renders nothing until the
 * roster loads.
 */
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { api, photoUrl, type TripMemberView } from '../../lib/api';
import { colors, font, radius, type } from '../../lib/theme';
import { OfflineHint } from '../../components/ui';
import { Input, PillButton } from './ManageTripSheet';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBERS_ERROR = "Couldn't update members — please try again.";

export function MembersSection({ tripId, online }: { tripId: string; online: boolean }) {
  const [members, setMembers] = useState<TripMemberView[] | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void api.members
      .list(tripId)
      .then((v) => {
        if (!cancelled) setMembers(v.members);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    void api.me
      .get()
      .catch(() => null)
      .then((j) => {
        if (!cancelled) setMeId(j?.user.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const mine = members?.find((m) => m.userId != null && m.userId === meId);
  const amOwner = mine?.role === 'owner';

  /** Run one roster write; sync the list from the response. */
  function run(fn: () => Promise<TripMemberView[]>) {
    setBusy(true);
    setError(false);
    void (async () => {
      try {
        const next = await fn();
        if (mounted.current) setMembers(next);
      } catch {
        if (mounted.current) setError(true);
      } finally {
        if (mounted.current) setBusy(false);
      }
    })();
  }

  if (!members) return null;

  const trimmedEmail = email.trim();
  const canInvite = online && !busy && EMAIL_RE.test(trimmedEmail);

  return (
    <>
      <Text style={s.heading}>
        Members <Text style={s.headingCount}>({members.length})</Text>
      </Text>
      {!online ? <OfflineHint /> : null}
      <View style={s.list}>
        {members.map((m) => {
          const isSelf = meId != null && m.userId === meId;
          const canRemove = m.role !== 'owner' && (amOwner || isSelf);
          return (
            <View key={m.id} style={s.row}>
              <View style={s.avatar}>
                {m.image ? (
                  <Image
                    source={{ uri: photoUrl.avatar(m.image) }}
                    style={s.avatarImage}
                    accessibilityLabel=""
                  />
                ) : (
                  <Text style={s.avatarLetter}>
                    {(m.name ?? m.invitedEmail).slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={s.nameWrap}>
                <Text style={s.name} numberOfLines={1}>
                  {m.name ?? m.invitedEmail}
                  {isSelf ? <Text style={s.nameYou}> (you)</Text> : null}
                </Text>
                {m.userId == null ? <Text style={s.pending}>Invite pending</Text> : null}
              </View>
              {m.role === 'owner' ? (
                <View style={s.ownerChip}>
                  <Text style={s.ownerChipText}>Owner</Text>
                </View>
              ) : canRemove ? (
                <PillButton
                  label={isSelf ? 'Leave' : 'Remove'}
                  tone="danger"
                  disabled={busy || !online}
                  onPress={() => run(async () => (await api.members.remove(tripId, m.id)).members)}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={s.inviteRow}>
        <Input
          value={email}
          onChangeText={setEmail}
          editable={!busy && online}
          placeholder="friend@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <PillButton
          label="Invite"
          tone="orange"
          disabled={!canInvite}
          onPress={() =>
            run(async () => {
              const { members: next } = await api.members.invite(tripId, trimmedEmail);
              if (mounted.current) setEmail('');
              return next;
            })
          }
        />
      </View>
      <Text style={s.hint}>
        Invited people see and edit this trip after signing in with that Google account.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={s.statusError}>
          {MEMBERS_ERROR}
        </Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  heading: { marginTop: 24, ...type.heading, color: colors.ink },
  headingCount: { fontFamily: font.regular, color: colors.sub },
  list: { marginTop: 8, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    height: 32,
    width: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { height: '100%', width: '100%' },
  avatarLetter: { fontSize: 13, fontFamily: font.semibold, color: colors.sub },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { ...type.body, color: colors.ink },
  nameYou: { color: colors.sub },
  pending: { ...type.caption, color: colors.faint },
  ownerChip: {
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownerChipText: { ...type.caption, color: colors.sub },
  inviteRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { marginTop: 6, ...type.caption, color: colors.sub },
  statusError: { marginTop: 4, ...type.caption, color: colors.danger },
});
