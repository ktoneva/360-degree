import type { CompetencyVariant, RaterGroup } from "@/lib/types";
import type {
  CompetencyComparisonRow,
  CompetencyOverviewRow,
  DevelopmentPriorityItemResult,
  GapItemResult,
  ItemAppendixRow,
  RankedItemMean,
  ResponseRateRow,
  SafeguardingItemCounts,
} from "@/lib/scoring";

interface WithItemLabel {
  behaviourText: string;
  competencyName: string;
}

export interface ReportData {
  leaderName: string;
  roleTitle: string | null;
  cycleName: string;
  periodStart: string;
  periodEnd: string;
  competency9Variant: CompetencyVariant;

  responseRates: ResponseRateRow[];
  competencyOverview: (CompetencyOverviewRow & { competencyName: string })[];
  raterGroupComparison: (CompetencyComparisonRow & { competencyName: string })[];
  blindSpots: (GapItemResult & WithItemLabel)[];
  hiddenStrengths: (GapItemResult & WithItemLabel)[];
  highestLowestItems: {
    highest: (RankedItemMean & WithItemLabel)[];
    lowest: (RankedItemMean & WithItemLabel)[];
  };
  developmentPriorities: (DevelopmentPriorityItemResult & WithItemLabel)[];
  itemAppendix: (ItemAppendixRow & WithItemLabel)[];
  safeguarding: (SafeguardingItemCounts & { behaviourText: string })[];
  comments: {
    raterId: string;
    group: RaterGroup;
    continueText: string | null;
    startText: string | null;
    stopText: string | null;
  }[];
}
