import { PromptBuilder } from "@/components/prompt-builder";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt Maker Control Room",
  description: "Engineer world-class AI prompts with guardrails, QA checklists, and adaptive scoring.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-indigo-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950">
      <PromptBuilder />
    </div>
  );
}
