export type OutcomeRule = { id: string; label: string; requiredSignals: string[]; forbiddenSignals?: string[]; score: number };
export type TheoryRef = { id: string; title: string };
export type ScenarioSignal = { id: string; patterns: string[] };
export type VariationOption = { id: string; parameter: string; label: string; values: string[] };
export type ScenarioVariation = { optionId: string; parameter: string; label: string; from: string; to: string; seed: number };
export type OpponentCharacter = {
  name: string; role: string; sphere: string; tone: string; personality: string;
  goals: string[]; redLines: string[]; style: string; systemPrompt: string;
  hiddenInterests?: string[]; constraints?: string[];
};
export type Scenario = {
  id: string; version?: number; title: string; description: string; playerBrief: string;
  playerRole?: string; playerGoal?: string; difficulty?: "Базовая" | "Средняя" | "Высокая";
  category?: string; mainSkill?: string; estimatedDuration?: string;
  status?: "draft" | "published";
  opponent: OpponentCharacter; outcomeRules?: OutcomeRule[]; signals?: ScenarioSignal[]; theory?: TheoryRef[];
  variationOptions?: VariationOption[]; variation?: ScenarioVariation;
  createdAt: string; updatedAt: string;
};
export type PublicScenario = Omit<Scenario, "opponent" | "outcomeRules" | "signals"> & {
  opponent: Pick<OpponentCharacter, "name" | "role" | "sphere" | "tone" | "personality" | "style">;
};
export type ChatMessage = { id?: string; role: "user" | "assistant" | "system"; content: string };
export type TemperatureReading = { score: number; reason: string };
export type ReportEvidence = { messageId: string; quote: string; explanation: string; rewrite: string; theoryId: string };
export type FinalReport = {
  outcome?: { id: string; label: string; score: number; signals: string[] };
  skillScores?: Record<string, number>; evidence?: ReportEvidence[]; nextExercise?: string;
  comparison?: { previousOutcome: string; scoreDelta: number; skillDeltas: Record<string, number>; changedCondition?: ScenarioVariation };
  strengths: string[]; weaknesses: string[]; recommendation: string; summary: string;
};
export type Attempt = {
  id: string; scenarioId: string; scenarioVersion: number; scenario: Scenario;
  baseScenario?: Scenario;
  status: "active" | "completed"; messages: ChatMessage[]; signals: string[];
  report: FinalReport | null; createdAt: string; updatedAt: string; previousAttemptId?: string;
  profileId?: string; practiceMode?: "guided" | "independent" | "diagnostic";
};
