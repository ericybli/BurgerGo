import { z } from 'zod';
import { restRead } from '@/src/lib/restRead';
import { restWrite } from '@/src/lib/restWrite';
import { listMembersAction, inviteMemberAction } from '@/app/_actions/members';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ tripId: string }> };

const inviteSchema = z.object({ email: z.string() });

/** Trip roster (pending invites included). */
export async function GET(req: Request, { params }: Ctx) {
  const { tripId } = await params;
  return restRead(req, tripId, async () => ({ members: await listMembersAction(tripId) }));
}

/** Invite. POST { email }. */
export async function POST(req: Request, { params }: Ctx) {
  const { tripId } = await params;
  return restWrite(
    req,
    async (body) => {
      const { email } = inviteSchema.parse(body);
      return { members: await inviteMemberAction(tripId, email) };
    },
    { tripId },
  );
}
