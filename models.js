const mongoose = require('mongoose');

// 1. Operator Schema
const OperatorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  mobile: { type: String, required: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// 2. Employee Schema
const EmployeeSchema = new mongoose.Schema({
  employeeNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  designation: { type: String, required: true },
  department: { type: String, default: '' },
  employmentType: { type: String, default: 'Regular' }, // Regular / Contract
  category: { type: String, default: '' },
  dob: { type: String, default: '' },
  doj: { type: String, default: '' },
  village: { type: String, default: '' },
  presentAddress: { type: String, default: '' },
  workLocation: { type: String, required: true },
  age: { type: Number, required: true },
  height: { type: Number, required: true },
  weight: { type: Number, required: true },
  pulse: { type: Number, required: true },
  bp: { type: String, required: true },
  sugar: { type: String, default: '' },
  issue: { type: String, default: '' },
  tabletsGiven: { type: String, default: '' },
  quantity: { type: Number, default: 0 },
  operatorId: { type: String, default: '' }
}, {
  timestamps: true
});

// 3. Test Report Schema
const TestReportSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  reportNumber: { type: String, required: true },
  reportDate: { type: Date, required: true, index: true },

  // Past History
  htn: { type: String, default: '' },
  dm: { type: String, default: '' },
  
  // General Exam
  rbs: { type: String, default: '' },

  // Renal
  serumCreatinine: { type: String, default: '' },
  serumUrea: { type: String, default: '' },

  // Cholinesterase
  serumCholinesterase: { type: String, default: '' },

  // Lipid Profile
  serumCholesterol: { type: String, default: '' },
  serumTriglycerides: { type: String, default: '' },
  hdl: { type: String, default: '' },
  ldl: { type: String, default: '' },
  vldl: { type: String, default: '' },

  // Complete Blood Picture
  totalLeucocytes: { type: String, default: '' },
  erythrocyteCount: { type: String, default: '' },
  neutrophils: { type: String, default: '' },
  lymphocytes: { type: String, default: '' },
  eosinophils: { type: String, default: '' },
  monocytes: { type: String, default: '' },
  basophils: { type: String, default: '' },
  esr: { type: String, default: '' },
  hb: { type: String, default: '' },
  plateletCount: { type: String, default: '' },
  packedCellVolume: { type: String, default: '' },
  mcv: { type: String, default: '' },
  mch: { type: String, default: '' },
  mchc: { type: String, default: '' },
  rcdw: { type: String, default: '' },
  rbcSmear: { type: String, default: '' },
  wbcSmear: { type: String, default: '' },
  plateletSmear: { type: String, default: '' },
  parasites: { type: String, default: '' },

  // Complete Urine Examination
  specificGravity: { type: String, default: '' },
  urinePh: { type: String, default: '' },
  urineAcetone: { type: String, default: '' },
  urineNitrites: { type: String, default: '' },
  ubs: { type: String, default: '' },
  ubp: { type: String, default: '' },
  urobilinogen: { type: String, default: '' },
  urineLeucocyte: { type: String, default: '' },
  urineAlbumin: { type: String, default: '' },
  urineSugar: { type: String, default: '' },
  uml: { type: String, default: '' },
  rbc: { type: String, default: '' },
  ec: { type: String, default: '' },
  casts: { type: String, default: '' },
  crystals: { type: String, default: '' },

  // Radiograph
  xrayReport: { type: String, default: '' },

  // Audiometry
  rightEar: { type: String, default: '' },
  leftEar: { type: String, default: '' },

  // Eye Examination
  rightEye: { type: String, default: '' },
  leftEye: { type: String, default: '' },

  uploadedFiles: [{ type: String }],
  operatorId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// 4. Medicine Schema
const MedicineSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  issue: { type: String, required: true },
  tabletsGiven: { type: String, required: false },
  quantity: { type: Number, required: false },
  temperature: { type: String, required: false },
  visitCategory: { type: String, required: false }, // First Aid / General
  firstAid: { type: String, required: false }, // First Aid Done / Referred to Hospital
  operatorId: { type: String, default: '' },
  issuedDate: { type: Date, default: Date.now }
});

// 5. Uploaded File Schema
const UploadedFileSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'TestReport', index: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  reportType: { type: String, enum: ['General', 'Yearly', 'Hospital'], default: 'General' },
  hospitalName: { type: String, default: '' },
  operatorId: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now }
});

// 6. Audit Log Schema
const AuditLogSchema = new mongoose.Schema({
  operatorId: { type: String, index: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

// 7. Hospital Suggestion Schema
const HospitalSuggestionSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  hospitalName: { type: String, required: true },
  reason: { type: String, required: true },
  amount: { type: Number, default: 0 },
  status: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
  arogyasri: { type: Boolean, default: false },
  operatorId: { type: String, default: '' },
  suggestedAt: { type: Date, default: Date.now }
});

// Export all models
const Operator = mongoose.model('Operator', OperatorSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);
const TestReport = mongoose.model('TestReport', TestReportSchema);
const Medicine = mongoose.model('Medicine', MedicineSchema);
const UploadedFile = mongoose.model('UploadedFile', UploadedFileSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
const HospitalSuggestion = mongoose.model('HospitalSuggestion', HospitalSuggestionSchema);

module.exports = {
  Operator,
  Employee,
  TestReport,
  Medicine,
  UploadedFile,
  AuditLog,
  HospitalSuggestion
};
