-- One-off anonymity exception (2) -- reuses the exact override mechanism
-- built for Charlotte Brennan (see 20260915010001_charlotte_brennan_
-- anonymity_exception.sql and review_cycles.anonymity_threshold_override's
-- own column comment). No schema change needed here, the column already
-- exists; this is purely a documented, one-off data change for a second,
-- separate cycle.
--
-- For Franki Gibsonfaux only (cycle 856377c3-031d-4d7c-8738-2de647054541):
-- self, manager and all 5 peers have completed and already clear the
-- standard n>=3 threshold on their own -- unaffected by this. Of 3 invited
-- direct reports, only 1 responded, the other 2 never started, and the
-- deadline has passed; there are no other raters to pool with for direct
-- reports. A completion shortfall, not a structural rater-pool problem like
-- Charlotte's, but the same fix applies: n>=3 cannot be met for her direct
-- reports and will not resolve itself. Decided once, for this report only,
-- not a precedent for future similar cases. See 360_educational_leaders_v15.xlsx,
-- Design decisions tab, row 27.
update review_cycles
set anonymity_threshold_override = 2
where id = '856377c3-031d-4d7c-8738-2de647054541';
