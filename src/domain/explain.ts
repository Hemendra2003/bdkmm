// Pure explanation formatter for Engine B results.
// Takes scored fields and returns human-readable strings; no math of its own.
export interface ExplainFields {
  eligible: boolean;
  status?: string;
  rawDv: number;
  mult: number;
  rawChange: number;
  shadow: number;
  intendedChange: number;
  actualChange: number;
  posStreak: number;
  negStreak: number;
}

export interface ScoreBreakdown {
  raw: string;
  mult: string;
  rawChange: string;
  shadow: string;
  intendedChange: string;
  actualChange: string;
  floored: boolean;
}

export interface ExplainResult {
  eligible: boolean;
  status: string;
  breakdown: ScoreBreakdown | null;
  engineStreakLine: string;
}

function signed(n: number): string {
  return n >= 0 ? '+' + String(n) : String(n);
}

export function explainResult(r: ExplainFields): ExplainResult {
  const status = r.status ?? (r.eligible ? 'scored' : 'no-action');
  const floored = r.eligible && r.intendedChange !== r.actualChange;

  const breakdown: ScoreBreakdown | null = r.eligible
    ? {
        raw: signed(r.rawDv),
        mult: '×' + r.mult.toFixed(2),
        rawChange: signed(r.rawChange),
        shadow: r.shadow === 0 ? '0' : '−' + String(r.shadow),
        intendedChange: signed(r.intendedChange),
        actualChange: signed(r.actualChange) + (floored ? ' (zero floor)' : ''),
        floored,
      }
    : null;

  let engineStreakLine: string;
  if (!r.eligible) {
    if (status === 'pending') engineStreakLine = 'Score pending — finish all actions to publish.';
    else if (status === 'no-action')
      engineStreakLine = 'No action score — all actions excused or none due.';
    else if (status === 'draft')
      engineStreakLine = 'Draft saved — no score or score streak change yet.';
    else engineStreakLine = 'No score this day.';
  } else {
    const ps = r.posStreak;
    const ns = r.negStreak;
    if (ps > 0) engineStreakLine = `${ps}-day positive score streak — multiplier compounding.`;
    else if (ns > 0)
      engineStreakLine = `${ns}-day negative score streak — penalty multiplier active.`;
    else engineStreakLine = 'Score streak reset. Build from here.';
  }

  return { eligible: r.eligible, status, breakdown, engineStreakLine };
}
