import BattleDetailClient from "./battle-detail-client";

export const instant = false;

export default async function BattleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <BattleDetailClient battleId={id} />
  );
}
