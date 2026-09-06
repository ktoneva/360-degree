-- Item wording review (v10 of the spec): 22 of 90 standard-variant items
-- rewritten to remove vague virtue language ("builds trust", "acts
-- constructively") in favour of a specific, concrete choice a leader either
-- makes or avoids. Same competency, same item number, same scale, same
-- rater-group routing, same item id -- only behaviour_text changes.
--
-- Matched by (competency number, item number) rather than item id, so this
-- stays correct regardless of the random ids any given environment's seed
-- migration happened to generate.

update items set behaviour_text = 'Makes time to see staff when they ask, rather than deferring or rescheduling repeatedly.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 1
    and competencies.variant = 'standard'
    and items.item_number = 3;

update items set behaviour_text = 'Asks questions that help someone work out their own answer, rather than giving them the answer directly.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 2
    and competencies.variant = 'standard'
    and items.item_number = 1;

update items set behaviour_text = 'Hands over a task fully, including the decision-making that goes with it, rather than delegating the task but keeping the decisions.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 2
    and competencies.variant = 'standard'
    and items.item_number = 2;

update items set behaviour_text = 'Lets someone lead a piece of work end-to-end, including the parts likely to go wrong, rather than stepping in early.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 2
    and competencies.variant = 'standard'
    and items.item_number = 5;

update items set behaviour_text = 'Uses 1:1 meetings for more than status updates, listening to what the person raises rather than working through their own agenda.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 2
    and competencies.variant = 'standard'
    and items.item_number = 9;

update items set behaviour_text = 'Talks about the organisation''s wider direction unprompted, not only when specifically asked to relay it.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 3
    and competencies.variant = 'standard'
    and items.item_number = 3;

update items set behaviour_text = 'Slows down or pauses a change when people are visibly struggling to keep up, rather than sticking to the original timeline regardless.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 3
    and competencies.variant = 'standard'
    and items.item_number = 10;

update items set behaviour_text = 'Says no to, or deprioritises, a lower-value task when demands compete, rather than trying to do everything at once.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 4
    and competencies.variant = 'standard'
    and items.item_number = 3;

update items set behaviour_text = 'Changes a decision when new evidence contradicts their original view, rather than sticking with the original plan regardless.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 4
    and competencies.variant = 'standard'
    and items.item_number = 6;

update items set behaviour_text = 'Protects time for a longer-term priority even when something urgent is competing for attention that day.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 4
    and competencies.variant = 'standard'
    and items.item_number = 7;

update items set behaviour_text = 'Keeps their tone and manner the same in a high-pressure moment as in a calm one, rather than becoming sharp, withdrawn or reactive.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 5
    and competencies.variant = 'standard'
    and items.item_number = 1;

update items set behaviour_text = 'Produces work of the same standard in a demanding week as in a normal one, rather than visibly cutting corners under pressure.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 5
    and competencies.variant = 'standard'
    and items.item_number = 5;

update items set behaviour_text = 'Meets their own deadlines and commitments without regularly needing to extend them or drop something else to cope.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 5
    and competencies.variant = 'standard'
    and items.item_number = 6;

update items set behaviour_text = 'Takes proper breaks and leaves work at a reasonable time themselves, rather than only telling others to do so.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 5
    and competencies.variant = 'standard'
    and items.item_number = 9;

update items set behaviour_text = 'Volunteers to help another team or area when asked, even when it is not their direct responsibility.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 6
    and competencies.variant = 'standard'
    and items.item_number = 6;

update items set behaviour_text = 'Names the impact on pupils when explaining an operational or budget decision, rather than discussing it only in cost or logistics terms.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 7
    and competencies.variant = 'standard'
    and items.item_number = 1;

update items set behaviour_text = 'Notices and raises a safeguarding-relevant detail themselves, rather than only responding when someone else flags it.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 7
    and competencies.variant = 'standard'
    and items.item_number = 2;

update items set behaviour_text = 'Adjusts an approach or decision specifically because it would disadvantage a particular group of pupils otherwise.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 7
    and competencies.variant = 'standard'
    and items.item_number = 8;

update items set behaviour_text = 'Interacts with pupils the same way when being observed as when they think no one is watching.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 7
    and competencies.variant = 'standard'
    and items.item_number = 10;

update items set behaviour_text = 'Raises a disagreement with someone more senior directly, rather than only agreeing in the room and voicing concerns elsewhere afterward.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 8
    and competencies.variant = 'standard'
    and items.item_number = 4;

update items set behaviour_text = 'Behaves the same way in front of governors or parents as they do in front of their own team.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 8
    and competencies.variant = 'standard'
    and items.item_number = 7;

update items set behaviour_text = 'Maintains contact with an external partner or agency between the times when something is actually needed from them.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 8
    and competencies.variant = 'standard'
    and items.item_number = 8;
