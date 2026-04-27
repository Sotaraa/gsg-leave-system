const CONFIG = {
  schoolName: "Gardener Schools Group",
  defaultDepartments: ['IT', 'HR', 'Finance', 'Marketing', 'Estates Team', 'Other'],

  // ── Leave types ───────────────────────────────────────────────────────────
  // 'Annual Leave'         — standard staff only; deducted from annual allowance
  // 'Extra Hours Worked'   — all non-TT staff; logs extra hours worked (builds TOIL credit)
  // 'School Holiday Worked'— term-time only; logs a day worked during school holidays (builds credit)
  // 'Time Off in Lieu'     — all staff; uses TOIL credit earned from extra/holiday working
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
    'Extra Hours Worked',
    'School Holiday Worked',
    'Term Time Leave',
  ],

  // Types that are recorded for HR purposes only (do NOT reduce allowance or target)
  nonDeductibleTypes: ['Sick Leave', 'CPD', 'Medical Appt', 'Compassionate', 'Unpaid', 'Extra Hours Worked', 'School Holiday Worked'],

  // ── Term-time contract constants ─────────────────────────────────────────
  termTimeWorkType:  'School Holiday Worked', // TT staff log days worked during school holidays
  termTimeLeaveType: 'Term Time Leave',        // TT absence during school term → adds to holiday-work target
  toiLeaveType:      'Time Off in Lieu',       // All staff take time off using earned TOIL credit
  extraHoursType:    'Extra Hours Worked',     // Non-TT staff log extra hours worked (builds TOIL credit)

  // Legacy type names kept for backwards-compatibility with existing Firestore records
  _legacyTermTimeWorkType: 'Holiday Work (Accrued)',
  _legacyProfDevType:      'Professional Dev',

  roles: ['Staff', 'Dept Head', 'Admin'],
  superAdmins: ['hitesh.bhojani@gardenerschools.com'],
  defaultAllowance: 20,
  defaultHoursPerDay: 8     // hours that constitute one working day (for TOIL hour-based entry)
};

export default CONFIG;
