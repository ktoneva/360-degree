-- v11 of the spec: the response scale drops from 6 points to 5 ("Often"
-- removed), rescored 1-5 in order (Almost never/Rarely/Sometimes/Usually/
-- Almost always). No historical response data exists to remap (verified
-- and cleared with the user first -- this project has no real client data
-- yet, only test submissions).
--
-- Also removes items 7.5 and 7.6 (the safeguarding integrity check) and
-- their routing wording entirely, per the same v11 instruction. Competency
-- 7's 8 scored behavioural items are unaffected -- their item_number values
-- are left as-is (1,2,3,4,7,8,9,10), not renumbered, matching the source
-- item bank exactly.

delete from items
  using competencies
  where items.competency_id = competencies.id
    and competencies.number = 7
    and competencies.variant = 'standard'
    and items.item_number in (5, 6);

alter table responses
  drop constraint if exists responses_scale_value_check;

alter table responses
  add constraint responses_scale_value_check
    check (scale_value between 1 and 5);
