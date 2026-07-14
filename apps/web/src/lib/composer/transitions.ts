import { TRANSITIONS } from "@/components/WizardSteps";

// value → human label (e.g. "whip" → "Savurma") for the between-clip transition buttons.
export const TRANSITION_LABELS: Record<string, string> = Object.fromEntries(
  TRANSITIONS.flatMap((g) => g.items).map((it) => [it.value, it.label]),
);

// Connector line between clips — echoes the sidebar's --frame palette (blue→purple→warm).
export const TR_GRADIENT = "linear-gradient(90deg, rgb(52,104,184), rgb(96,64,168), rgb(170,86,96))";
// Soft tint of the same palette for the transition node button.
export const TR_GRADIENT_SOFT = "linear-gradient(135deg, rgba(52,104,184,0.16), rgba(96,64,168,0.16), rgba(170,86,96,0.16))";
