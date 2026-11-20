# Cohort Payment (เงินรุ่น)

LIFF + Sheet workflow for members to bind identity, submit payment slips, and track approved contributions toward a class fund plan.

## Language

**Member**:
A person in the cohort roster who may bind one LINE account and submit payments.
_Avoid_: User, student (unless member_id literally is a student id)

**ยอดอนุมัติสะสม (Approved Total / `total_paid`)**:
The sum of this member's transaction amounts with status Approved.
_Avoid_: paid total that includes Pending

**เป้าหมายทั้งแผน (Plan Total)**:
`monthly_amount × plan_months` for the cohort (e.g. 300 × 12 = 3,600).
_Avoid_: goal, quota (unless speaking informally)

**ยอดที่ควรมีถึงเดือนนี้ (Expected To Date)**:
The amount a member should have approved by the current calendar plan month: `month_index × monthly_amount`, capped by plan months.
_Avoid_: due this month (that implies only the current installment, not cumulative)

**ความคืบหน้าแผน (Plan Progress)**:
How far Approved Total is toward Plan Total; shown as the main progress bar.
_Avoid_: progress toward Expected To Date as the primary bar fill

**เป้าเดือนนี้ (Current-Month Marker)**:
The position of Expected To Date on the Plan Progress bar.
_Avoid_: second progress bar fill for the primary metric

**Transaction**:
One payment submission with slip evidence and review status Pending / Approved / Rejected.
_Avoid_: payment (ambiguous with bank transfer vs the recorded row)

**Bind**:
One-time link of a LINE userId to a Member via member_id confirmation.
_Avoid_: register, signup
