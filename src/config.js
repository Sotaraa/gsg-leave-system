const CONFIG = {
  schoolName: "Gardener Schools Group",
  defaultDepartments: ['IT', 'HR', 'Finance', 'Marketing', 'Estates Team', 'Other'],

  // ── Leave types ───────────────────────────────────────────────────────────
  // 'Annual Leave'         — standard staff only; deducted from annual allowance
  // 'School Holiday Worked'— term-time only; logs a day worked during school holidays (builds credit)
  // 'Time Off in Lieu'     — term-time only; uses credit earned from holiday working
  // 'Term Time Leave'      — term-time only; absence during school term; adds to holiday-work target
  // 'Unpaid'               — all staff; recorded for HR purposes only, no allowance deducted
  leaveTypes: [
    'Annual Leave',
    'Sick Leave',
    'CPD',
    'Medical Appt',
    'Compassionate',
    'Unpaid',
    'Time Off in Lieu',
    'School Holiday Worked',
    'Term Time Leave',
  ],

  // Types that are recorded for HR purposes only (do NOT reduce allowance or target)
  nonDeductibleTypes: ['Sick Leave', 'CPD', 'Medical Appt', 'Compassionate', 'Unpaid'],

  // ── Term-time contract constants ─────────────────────────────────────────
  termTimeWorkType:  'School Holiday Worked', // TT staff log days worked during school holidays
  termTimeLeaveType: 'Term Time Leave',        // TT absence during school term → adds to holiday-work target
  toiLeaveType:      'Time Off in Lieu',       // TT staff take time off using earned holiday credit

  // Legacy type names kept for backwards-compatibility with existing Firestore records
  _legacyTermTimeWorkType: 'Holiday Work (Accrued)',
  _legacyProfDevType:      'Professional Dev',

  roles: ['Staff', 'Dept Head', 'Admin'],
  superAdmins: ['hitesh.bhojani@gardenerschools.com'],
  defaultAllowance: 20
};

export default CONFIG;
