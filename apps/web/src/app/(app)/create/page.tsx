import { CreateWizard } from "@/components/CreateWizard";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  return <CreateWizard draftId={draft} />;
}
