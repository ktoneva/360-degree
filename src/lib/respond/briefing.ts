import type { RaterGroup } from "@/lib/types";

/**
 * Fixed briefing copy from the "Rater briefing" tab of the spec spreadsheet.
 * [NAME] is filled in with the leader's name; [N] with this rater's item count.
 */

export function generalIntro(leaderName: string, itemCount: number): string {
  return `You have been asked to give feedback on ${leaderName} as part of a leadership development review. This is for their development. It is not a performance appraisal and it does not feed into any pay or capability decision.

There are ${itemCount} statements. Most people take about 15 minutes. Answer on how often you see the behaviour, not on how you think they intend to behave. If you have not seen something, choose 'Not able to comment'. That is a real answer and it is more useful than a guess.

Your individual answers are not shown to ${leaderName}. Results are reported as group averages and only where at least three people in your group have responded. Your manager's ratings are reported separately and they know that.

Written comments are shown to ${leaderName} in full. Write them as you would want to receive them.`;
}

function groupSpecificWording(raterGroup: RaterGroup, leaderName: string): string {
  switch (raterGroup) {
    case "self":
      return `This is your own view, in your own words, before you see anyone else's. Complete it first.

Rate how often you actually do each thing, not how often you would like to. The value of this exercise is in the gap between your answers and everyone else's, and that gap only means something if you have been honest here. Leaders who rate themselves generously get a report that looks like an ambush. Leaders who rate themselves accurately get a report they can use.`;
    case "manager":
      return `You are the only rater in your group, so your answers are reported separately and are identifiable. ${leaderName} knows this.

That makes precision more useful than kindness. Use the full range of the scale. If everything is 'usually', the report tells them nothing they can act on. Where you have never observed something, say so rather than inferring it from their reputation.

The two behaviours you nominate as development priorities carry more weight than any single rating. Choose the two that would genuinely change their effectiveness, not the two that are easiest to say.`;
    case "peer":
      return `You see this leader from beside rather than above or below, which means you see things nobody else does: how they behave when there is nothing to gain, whether they follow through on things they agreed with you, and what happens to their work when it reaches your team.

Your ratings are pooled with other peers and reported only if at least three of you respond. Nothing is attributed to you.

Rate what you have observed directly. Skip the rest.`;
    case "direct_report":
      return `You are the only group who can answer some of these questions honestly, particularly the ones about 1:1s, feedback and whether monitoring of your work actually helps you.

Your ratings are pooled with the other people who report to ${leaderName} and reported only if at least three of you respond. Individual answers are never shown, and neither are the ratings of any group of fewer than three.

If you are worried about being identified in written comments, describe the pattern rather than the incident.`;
    case "other":
      return `You work with ${leaderName} without reporting to them, which is exactly why you are being asked. Accessibility, responsiveness and reliability across a dotted line are usually invisible to the people above a leader and obvious to the people beside them.

You will see a shorter set of statements, only the ones you are in a position to judge. Your answers are pooled and reported only if at least three people in this group respond.`;
  }
}

export function groupWording(
  raterGroup: RaterGroup,
  leaderName: string,
  competencyNames: string[],
): string {
  const list = competencyNames.map((name, i) => `${i + 1}. ${name}`).join("\n");

  return `${groupSpecificWording(raterGroup, leaderName)}

If you need to stop partway through, your answers so far are saved. You can come back and finish later using the same link.

You'll be asked about:
${list}`;
}

export const SAFEGUARDING_WORDING = `Two statements in this section ask about safeguarding practice. They are answered yes / no / not observed and they are not scored.

This questionnaire is not a route for reporting a safeguarding concern and no one is monitoring it in real time. If you have a concern about a child or about adult conduct, stop and contact your Designated Safeguarding Lead now, or the local authority designated officer if the concern is about a member of staff.`;
