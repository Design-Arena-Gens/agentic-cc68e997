"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clipboard,
  Download,
  Flame,
  Gauge,
  Lightbulb,
  ListChecks,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";

import {
  BASE_SECTIONS,
  PRESET_GUARDRAILS,
  PRESET_SUCCESS_CRITERIA,
  PROMPT_TEMPLATES,
  PromptBuilderOptions,
  PromptImprovement,
  PromptSectionState,
  PromptTemplate,
  synthesizePrompt,
  seedStateFromBlueprint,
} from "@/lib/promptEngine";
import { cn } from "@/lib/utils";

type PendingSection = {
  label: string;
  description: string;
};

const defaultTemplate = PROMPT_TEMPLATES[0];

const defaultAudience =
  "Executive stakeholders and cross-functional collaborators who will act on the output.";
const defaultResponseFormat =
  "Use structured markdown with descriptive headings, tables where relevant, and a concise executive summary.";

const baseOptionsForTemplate = (
  template: PromptTemplate,
  previous?: Partial<PromptBuilderOptions>,
): PromptBuilderOptions => ({
  targetAudience: previous?.targetAudience ?? defaultAudience,
  responseFormat: template.outputFormat ?? previous?.responseFormat ?? defaultResponseFormat,
  creativityLevel: previous?.creativityLevel ?? 6,
  temperature: previous?.temperature ?? 0.6,
  tone: template.tone,
  persona: template.persona,
  guardrails: Array.from(
    new Set([
      ...(template.guardrails ?? []),
      ...(previous?.guardrails ?? [PRESET_GUARDRAILS[0], PRESET_GUARDRAILS[1]]),
    ]),
  ),
  successCriteria:
    previous?.successCriteria ?? [PRESET_SUCCESS_CRITERIA[0], PRESET_SUCCESS_CRITERIA[2], PRESET_SUCCESS_CRITERIA[3]],
});

const initialOptions: PromptBuilderOptions = baseOptionsForTemplate(defaultTemplate);

const metricsConfig = [
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "specificity", label: "Specificity" },
  { key: "guardrails", label: "Guardrails" },
  { key: "creativity", label: "Creativity" },
] as const;

export function PromptBuilder() {
  const [activeTemplateId, setActiveTemplateId] = useState(defaultTemplate.id);
  const [sections, setSections] = useState<PromptSectionState[]>(
    seedStateFromBlueprint(BASE_SECTIONS, defaultTemplate),
  );
  const [options, setOptions] = useState<PromptBuilderOptions>(initialOptions);
  const [customGuardrail, setCustomGuardrail] = useState("");
  const [customSuccess, setCustomSuccess] = useState("");
  const [pendingSection, setPendingSection] = useState<PendingSection>({ label: "", description: "" });
  const [copied, setCopied] = useState(false);

  const activeTemplate = useMemo(
    () => PROMPT_TEMPLATES.find((template) => template.id === activeTemplateId) ?? PROMPT_TEMPLATES[0],
    [activeTemplateId],
  );

  const availableGuardrails = useMemo(
    () => Array.from(new Set([...PRESET_GUARDRAILS, ...(activeTemplate.guardrails ?? []), ...options.guardrails])),
    [activeTemplate, options.guardrails],
  );

  const availableSuccessCriteria = useMemo(
    () =>
      Array.from(
        new Set([
          ...PRESET_SUCCESS_CRITERIA,
          ...(options.successCriteria ?? []),
          "Explicitly state assumptions and unresolved questions.",
        ]),
      ),
    [options.successCriteria],
  );

  const synthesis = useMemo(() => synthesizePrompt(sections, options), [sections, options]);

  const handleSectionChange = (sectionId: string, value: string) => {
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, value } : section)),
    );
  };

  const handleApplyImprovement = (improvement: PromptImprovement) => {
    setSections((current) =>
      current.map((section) =>
        section.id === improvement.targetSectionId && !section.value.includes(improvement.snippet)
          ? {
              ...section,
              value: `${section.value.trim()}\n${section.value.trim() ? "\n" : ""}${improvement.snippet}`.trim(),
            }
          : section,
      ),
    );
  };

  const handleToggleGuardrail = (text: string) => {
    setOptions((current) => {
      const exists = current.guardrails.includes(text);
      return {
        ...current,
        guardrails: exists
          ? current.guardrails.filter((guardrail) => guardrail !== text)
          : [...current.guardrails, text],
      };
    });
  };

  const handleToggleSuccess = (text: string) => {
    setOptions((current) => {
      const exists = current.successCriteria.includes(text);
      return {
        ...current,
        successCriteria: exists
          ? current.successCriteria.filter((criterion) => criterion !== text)
          : [...current.successCriteria, text],
      };
    });
  };

  const handleAddGuardrail = () => {
    const trimmed = customGuardrail.trim();
    if (!trimmed) return;
    setOptions((current) =>
      current.guardrails.includes(trimmed)
        ? current
        : {
            ...current,
            guardrails: [...current.guardrails, trimmed],
          },
    );
    setCustomGuardrail("");
  };

  const handleAddSuccessCriteria = () => {
    const trimmed = customSuccess.trim();
    if (!trimmed) return;
    setOptions((current) =>
      current.successCriteria.includes(trimmed)
        ? current
        : {
            ...current,
            successCriteria: [...current.successCriteria, trimmed],
          },
    );
    setCustomSuccess("");
  };

  const handleAddSection = () => {
    const label = pendingSection.label.trim();
    if (!label) return;
    const description = pendingSection.description.trim() || "Add domain-specific guidance or nuance.";
    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (sections.some((section) => section.id === id)) {
      setPendingSection({ label: "", description: "" });
      return;
    }

    const newSection: PromptSectionState = {
      id,
      label,
      description,
      placeholder: "Describe the nuance the AI should consider.",
      value: "",
    };

    setSections((current) => [...current, newSection]);
    setPendingSection({ label: "", description: "" });
  };

  const handleSelectTemplate = (template: PromptTemplate) => {
    setActiveTemplateId(template.id);
    setSections(seedStateFromBlueprint(BASE_SECTIONS, template));
    setOptions((current) => baseOptionsForTemplate(template, current));
  };

  const handleReset = () => {
    setSections(seedStateFromBlueprint(BASE_SECTIONS, activeTemplate));
    setOptions(baseOptionsForTemplate(activeTemplate));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(synthesis.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("Clipboard copy failed", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            template: activeTemplate,
            sections: sections.map(({ value, id, label }) => ({ id, label, value })),
            configuration: options,
            generatedPrompt: synthesis.prompt,
            insights: synthesis.insights,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTemplate.name.toLowerCase().replace(/\s+/g, "-")}-prompt.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-10 lg:flex-row">
      <div className="flex min-h-screen flex-1 flex-col gap-6 pb-20">
        <header className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm ring-1 ring-black/[0.02] backdrop-blur lg:sticky lg:top-6 lg:z-10 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300">
                Prompt Engineering Control Room
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Build a production-grade AI instruction set
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Shape high-fidelity prompts with precision guardrails, measurable success criteria, and a reasoning
                workflow the model can actually follow.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Prompt"}
              </button>
            </div>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="flex items-center gap-2 font-medium text-zinc-600 dark:text-zinc-300">
                <Gauge className="h-4 w-4" />
                Overall Score
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {(synthesis.metrics.overall * 100).toFixed(0)}%
              </dd>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="flex items-center gap-2 font-medium text-zinc-600 dark:text-zinc-300">
                <Flame className="h-4 w-4" />
                Creativity Target
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{options.creativityLevel}/10</dd>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="flex items-center gap-2 font-medium text-zinc-600 dark:text-zinc-300">
                <ListChecks className="h-4 w-4" />
                Guardrails
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{options.guardrails.length}</dd>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="flex items-center gap-2 font-medium text-zinc-600 dark:text-zinc-300">
                <Sparkles className="h-4 w-4" />
                Tokens (est.)
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {synthesis.metrics.estimatedTokens}
              </dd>
            </div>
          </dl>
        </header>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Intelligent Templates</h2>
            <span className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300">
              Choose focus
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {PROMPT_TEMPLATES.map((template) => {
              const isActive = template.id === activeTemplateId;
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    "group flex h-full flex-col items-start rounded-2xl border p-5 text-left transition",
                    isActive
                      ? "border-indigo-500 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/30"
                      : "border-zinc-200 hover:border-indigo-400 dark:border-zinc-700 dark:hover:border-indigo-400",
                  )}
                >
                  <div className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    {template.category}
                    {isActive && <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] text-white">Active</span>}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{template.name}</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{template.description}</p>
                  <p className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                    Persona: <span className="font-normal text-zinc-600 dark:text-zinc-300">{template.persona}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Instruction Signals</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tune persona, tone, and response format so the model locks onto your desired outcome.
              </p>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
              Export JSON Snapshot
            </button>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Persona the model should embody</span>
              <textarea
                value={options.persona}
                onChange={(event) => setOptions((current) => ({ ...current, persona: event.target.value }))}
                rows={3}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Intended audience</span>
              <textarea
                value={options.targetAudience}
                onChange={(event) => setOptions((current) => ({ ...current, targetAudience: event.target.value }))}
                rows={3}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Tone of voice</span>
              <input
                value={options.tone}
                onChange={(event) => setOptions((current) => ({ ...current, tone: event.target.value }))}
                className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Response format blueprint</span>
              <textarea
                value={options.responseFormat}
                onChange={(event) => setOptions((current) => ({ ...current, responseFormat: event.target.value }))}
                rows={3}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
              <label className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Creativity target
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {options.creativityLevel}/10
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={options.creativityLevel}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    creativityLevel: Number(event.target.value),
                  }))
                }
                className="mt-4 w-full accent-indigo-600"
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
              <label className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Temperature recommendation
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {options.temperature.toFixed(2)}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={options.temperature}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    temperature: Number(event.target.value),
                  }))
                }
                className="mt-4 w-full accent-indigo-600"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Prompt Architecture</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Layer in rich context. The engine scores coverage and suggests ways to strengthen each section.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={pendingSection.label}
                onChange={(event) =>
                  setPendingSection((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="Add custom dimension"
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                onClick={handleAddSection}
                className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
              >
                <PlusCircle className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          {pendingSection.label && (
            <div className="mt-3">
              <textarea
                value={pendingSection.description}
                onChange={(event) =>
                  setPendingSection((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe what the AI should consider in this section."
                rows={2}
                className="w-full rounded-2xl border border-dashed border-indigo-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-zinc-100"
              />
            </div>
          )}

          <div className="mt-6 grid gap-5">
            {sections.map((section) => (
              <div
                key={section.id}
                className={cn(
                  "rounded-3xl border p-5 transition",
                  section.required
                    ? "border-indigo-100 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-900/20"
                    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {section.label}
                      {section.required && (
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                          required
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{section.description}</p>
                  </div>
                  <span className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                    {(section.value.trim().split(/\s+/).filter(Boolean).length || 0).toString()} words
                  </span>
                </div>
                <textarea
                  value={section.value}
                  onChange={(event) => handleSectionChange(section.id, event.target.value)}
                  rows={5}
                  placeholder={section.placeholder}
                  className="mt-4 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {synthesis.improvements
                    .filter((improvement) => improvement.targetSectionId === section.id)
                    .map((improvement) => (
                      <button
                        key={improvement.id}
                        onClick={() => handleApplyImprovement(improvement)}
                        className="flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {improvement.title}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Guardrails & QA Checklist</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Lock in non-negotiables and force the AI to double-check its work before responding.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300">
                Guardrails
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableGuardrails.map((guardrail) => {
                  const active = options.guardrails.includes(guardrail);
                  return (
                    <button
                      key={guardrail}
                      onClick={() => handleToggleGuardrail(guardrail)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        active
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                          : "border-zinc-300 text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300",
                      )}
                    >
                      {guardrail}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={customGuardrail}
                  onChange={(event) => setCustomGuardrail(event.target.value)}
                  placeholder="Add custom guardrail"
                  className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={handleAddGuardrail}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300">
                Success Criteria
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableSuccessCriteria.map((criterion) => {
                  const active = options.successCriteria.includes(criterion);
                  return (
                    <button
                      key={criterion}
                      onClick={() => handleToggleSuccess(criterion)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                          : "border-zinc-300 text-zinc-600 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-emerald-400 dark:hover:text-emerald-300",
                      )}
                    >
                      {criterion}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={customSuccess}
                  onChange={(event) => setCustomSuccess(event.target.value)}
                  placeholder="Add custom success metric"
                  className="flex-1 rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={handleAddSuccessCriteria}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Prompt Preview</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Final assembled instructions updated live as you craft the prompt.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/60 p-6 text-sm leading-relaxed text-zinc-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-zinc-100">
            <pre className="whitespace-pre-wrap font-mono text-sm">{synthesis.prompt}</pre>
          </div>
        </section>
      </div>

      <aside className="flex w-full max-w-xl flex-col gap-6 lg:sticky lg:top-6">
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Quality Intelligence</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live scoring keeps your prompt sharp across multiple signal dimensions.
          </p>
          <div className="mt-6 grid gap-4">
            {metricsConfig.map(({ key, label }) => {
              const score = synthesis.metrics[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <span>{label}</span>
                    <span>{Math.round(score * 100)}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 transition-all"
                      style={{ width: `${Math.round(score * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <p>
              <strong>Word Count:</strong> {synthesis.metrics.wordCount} • <strong>Estimated Tokens:</strong>{" "}
              {synthesis.metrics.estimatedTokens}
            </p>
            <p className="mt-2">
              High-performing prompts usually sit between 120-400 words. Ensure every section carries unique information.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Actionable Insights
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Resolve the most critical issues first. Suggestions adapt as you refine sections.
          </p>
          <div className="mt-5 space-y-4">
            {synthesis.insights.map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  "rounded-2xl border p-4 text-sm shadow-sm transition",
                  insight.severity === "critical"
                    ? "border-rose-200 bg-rose-50/80 dark:border-rose-700/60 dark:bg-rose-900/20"
                    : insight.severity === "warning"
                    ? "border-amber-200 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-900/20"
                    : "border-indigo-100 bg-indigo-50/70 dark:border-indigo-800/50 dark:bg-indigo-900/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{insight.title}</p>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-300">{insight.detail}</p>
                    {insight.suggestion && (
                      <button
                        onClick={() => insight.targetSectionId && handleSectionChange(insight.targetSectionId, insight.suggestion ?? "")}
                        className="mt-3 inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
                      >
                        Apply suggestion
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {synthesis.insights.length === 0 && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-200">
                Looking sharp. Add more nuance to push the score closer to perfection.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm ring-1 ring-black/[0.02] dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Keyword Signal Map</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Surface dominant themes the model will anchor on. Balance strategic and tactical language.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {synthesis.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              >
                #{keyword}
              </span>
            ))}
            {synthesis.keywords.length === 0 && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Start filling sections to see keyword signals.</span>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
