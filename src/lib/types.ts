export type RaterGroup = "self" | "manager" | "peer" | "direct_report" | "other";
export type CompetencyVariant = "standard" | "ops";
export type CycleStatus = "draft" | "open" | "closed";
export type LeaderLevel =
  | "headteacher"
  | "deputy_head"
  | "assistant_head"
  | "middle_leader"
  | "operational_business_leader";

export const LEADER_LEVELS: LeaderLevel[] = [
  "headteacher",
  "deputy_head",
  "assistant_head",
  "middle_leader",
  "operational_business_leader",
];

export const LEADER_LEVEL_LABELS: Record<LeaderLevel, string> = {
  headteacher: "Headteacher",
  deputy_head: "Deputy Head",
  assistant_head: "Assistant Head",
  middle_leader: "Middle Leader",
  operational_business_leader: "Operational and Business Leader",
};

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

/** How many development priorities a rater must pick for their forced
 * choice to count at all (v10 of the spec: 3, all required). */
export const FORCED_CHOICE_PRIORITY_COUNT = 3;

export interface ReviewSubject {
  id: string;
  full_name: string;
  role_title: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
}

export interface ReviewCycle {
  id: string;
  review_subject_id: string;
  organisation_id: string | null;
  level: LeaderLevel | null;
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
  archived_at: string | null;
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
