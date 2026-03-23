// src/data/mockdata.js

export const mock_staff = [
  {
    id: "staff_001",
    name: "Jane Doe",
    email: "jane.doe@school.ac.uk",
    department: "IT",
    role: "Staff",
    allowance: 25
  },
  {
    id: "staff_002",
    name: "John Smith",
    email: "john.smith@school.ac.uk",
    department: "HR",
    role: "Manager",
    allowance: 30
  }
];

export const mock_requests = [
  {
    id: "req_101",
    employeeEmail: "jane.doe@school.ac.uk",
    employeeName: "Jane Doe",
    department: "IT",
    startDate: "2026-02-01",
    endDate: "2026-02-05",
    type: "Annual Leave",
    daysCount: 5,
    status: "Approved",
    isHalfDay: false,
    submittedAt: "2026-01-10T10:00:00Z"
  }
];

export const config = {
  schoolName: "Gardener Schools Group Ltd",
  departments: ['IT', 'HR', 'Finance', 'Marketing', 'Estates Team', 'Other'],
  leaveTypes: ['Annual Leave', 'Sick Leave', 'Professional Dev', 'Medical Appt', 'Compassionate'],
  defaultAllowance: 25
};
