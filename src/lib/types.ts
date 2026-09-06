export type RaterGroup = "self" | "manager" | "peer" | "direct_report" | "other";
export type CompetencyVariant = "standard" | "ops";
export type CycleStatus = "draft" | "open" | "closed";

export const RATER_GROUPS: RaterGroup[] = [
  "self",
  "manager",
  "peer",
  "direct_report",
  "other",
];

export const RATER_GROUP_LABELS: Record<RaterGroup, string> = {
  self: "Self",
  manager: "Manager",
  peer: "Peers",
  direct_report: "Direct reports",
  other: "Others / contributors",
};

export interface ReviewSubject {
  id: string;
  full_name: string;
  role_title: string | null;
}

export interface ReviewCycle {
  id: string;
  review_subject_id: string;
  name: string;
  period_start: string;
  period_end: string;
  competency_9_variant: CompetencyVariant;
  status: CycleStatus;
  link_expiry_days: number;
}

export interface Rater {
  id: string;
  review_cycle_id: string;
  rater_group: RaterGroup;
  full_name: string | null;
  email: string | null;
  token: string;
  invited_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type ItemResponseType = "scale" | "yes_no_not_observed";

export interface AssignedItem {
  id: string;
  competency_number: number;
  competency_name: string;
  item_number: number;
  behaviour_text: string;
  response_type: ItemResponseType;
  is_integrity_item: boolean;
}

export type IntegrityValue = "yes" | "no" | "not_observed";

export interface ResponseValue {
  scale_value: number | null;
  not_observed: boolean;
  integrity_value: IntegrityValue | null;
}

export interface CommentsValue {
  continue_text: string;
  start_text: string;
  stop_text: string;
}
