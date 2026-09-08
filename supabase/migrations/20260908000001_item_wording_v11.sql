-- Item wording review (v11 of the spec): 3 items reworded, same competency,
-- same item number, same scale, same rater-group routing, same item id --
-- only behaviour_text changes. Matched by (competency number, item number)
-- for the same portability reason as the v10 wording migration.

update items set behaviour_text = 'Trusts others to lead a piece of work end-to-end, and avoids stepping in early.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 2
    and competencies.variant = 'standard'
    and items.item_number = 5;

update items set behaviour_text = 'When old ways of work are no longer effective, challenges those in a constructive way.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 3
    and competencies.variant = 'standard'
    and items.item_number = 8;

update items set behaviour_text = 'Behaves the same way in front of wider stakeholders, governors or parents as they do in front of their own team.'
  from competencies
  where items.competency_id = competencies.id
    and competencies.number = 8
    and competencies.variant = 'standard'
    and items.item_number = 7;
