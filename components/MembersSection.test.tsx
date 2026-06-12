import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { MemberView } from '@/src/db/repos/tripMembers';


// ── server action mocks ──────────────────────────────────────────────────────
const listMembersAction = vi.fn<() => Promise<MemberView[]>>();
const inviteMemberAction = vi.fn<() => Promise<MemberView[]>>();
const removeMemberAction = vi.fn<() => Promise<MemberView[]>>();

vi.mock('@/app/_actions/members', () => ({
  listMembersAction: (...args: Parameters<typeof listMembersAction>) => listMembersAction(...args),
  inviteMemberAction: (...args: Parameters<typeof inviteMemberAction>) => inviteMemberAction(...args),
  removeMemberAction: (...args: Parameters<typeof removeMemberAction>) => removeMemberAction(...args),
}));

// ── basePath stub ─────────────────────────────────────────────────────────────
vi.mock('@/src/lib/basePath', () => ({
  withBase: (path: string) => path,
}));

// ── sample fixtures ───────────────────────────────────────────────────────────
const OWNER: MemberView = {
  id: 'm-owner',
  tripId: 'trip-1',
  userId: 'u-me',
  invitedEmail: 'owner@example.com',
  role: 'owner',
  name: 'Alice',
  image: null,
};

const MEMBER: MemberView = {
  id: 'm-bob',
  tripId: 'trip-1',
  userId: 'u-bob',
  invitedEmail: 'bob@example.com',
  role: 'member',
  name: 'Bob',
  image: null,
};

const PENDING: MemberView = {
  id: 'm-pending',
  tripId: 'trip-1',
  userId: null,
  invitedEmail: 'pending@example.com',
  role: 'member',
  name: null,
  image: null,
};

function mockMe(userId: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: userId !== null,
      json: async () => (userId ? { user: { id: userId } } : null),
    })) as unknown as typeof fetch,
  );
}

// Import after mocks are hoisted (vitest hoists vi.mock to the top).
import { MembersSection } from './MembersSection';

function renderSection(tripId = 'trip-1') {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MembersSection tripId={tripId} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listMembersAction.mockResolvedValue([OWNER, MEMBER, PENDING]);
  inviteMemberAction.mockResolvedValue([OWNER, MEMBER, PENDING]);
  removeMemberAction.mockResolvedValue([OWNER]);
  mockMe('u-me');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('MembersSection', () => {
  it('renders the roster with owner chip and pending tag', async () => {
    renderSection();
    // Owner chip
    expect(await screen.findByText(en.members.owner)).toBeInTheDocument();
    // Member's name
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Pending invite label
    expect(screen.getByText(en.members.pending)).toBeInTheDocument();
  });

  it('invite button is disabled for invalid email and enabled for valid one', async () => {
    renderSection();
    await screen.findByText(en.members.owner); // wait for load

    const inviteBtn = screen.getByRole('button', { name: en.members.invite });
    // Initially disabled (empty email)
    expect(inviteBtn).toBeDisabled();

    // Type an invalid email — still disabled
    const emailInput = screen.getByPlaceholderText(en.members.emailPlaceholder);
    await userEvent.type(emailInput, 'notanemail');
    expect(inviteBtn).toBeDisabled();

    // Type a valid email — enabled
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'newperson@example.com');
    expect(inviteBtn).toBeEnabled();
  });

  it('calls inviteMemberAction and clears the input on invite', async () => {
    inviteMemberAction.mockResolvedValue([OWNER, MEMBER, PENDING]);
    renderSection();
    await screen.findByText(en.members.owner);

    const emailInput = screen.getByPlaceholderText(en.members.emailPlaceholder);
    await userEvent.type(emailInput, 'newperson@example.com');
    await userEvent.click(screen.getByRole('button', { name: en.members.invite }));

    await waitFor(() =>
      expect(inviteMemberAction).toHaveBeenCalledWith('trip-1', 'newperson@example.com'),
    );
    // Input should clear after successful invite
    await waitFor(() => expect((emailInput as HTMLInputElement).value).toBe(''));
  });

  it('calls removeMemberAction when the owner clicks Remove on a member', async () => {
    // Use only owner + one member so there is exactly one Remove button.
    listMembersAction.mockResolvedValue([OWNER, MEMBER]);
    renderSection();
    await screen.findByText(en.members.owner);

    const removeBtn = screen.getByRole('button', { name: en.members.remove });
    await userEvent.click(removeBtn);

    await waitFor(() =>
      expect(removeMemberAction).toHaveBeenCalledWith('trip-1', 'm-bob'),
    );
  });

  it('shows error alert when an action fails', async () => {
    inviteMemberAction.mockRejectedValue(new Error('server error'));
    renderSection();
    await screen.findByText(en.members.owner);

    const emailInput = screen.getByPlaceholderText(en.members.emailPlaceholder);
    await userEvent.type(emailInput, 'fail@example.com');
    await userEvent.click(screen.getByRole('button', { name: en.members.invite }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.members.error);
  });

  it('renders nothing while loading (null state)', () => {
    // Never resolve the action
    listMembersAction.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.queryByText(en.members.title)).not.toBeInTheDocument();
  });
});
