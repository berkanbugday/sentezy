import { CreateWizard } from "@/components/CreateWizard";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ draft?: string; prompt?: string }> }) {
  const { draft, prompt } = await searchParams;
  return <CreateWizard draftId={draft} initialPrompt={prompt} />;
}
