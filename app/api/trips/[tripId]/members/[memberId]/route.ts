import { restWrite } from '@/src/lib/restWrite';
import { removeMemberAction } from '@/app/_actions/members';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ tripId: string; memberId: string }> };

/** Remove a member (owner removes anyone but the owner row; a member removes only themself = leave). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { tripId, memberId } = await params;
  return restWrite(req, async () => ({ members: await removeMemberAction(tripId, memberId) }), {
    tripId,
  });
}
