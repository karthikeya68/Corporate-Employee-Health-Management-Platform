const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Operator, Employee, TestReport, Medicine, AuditLog } = require('./models');

const MONGO_URI = 'mongodb://localhost:27017/caretaker';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to database to initialize sample data.');

    // Clear existing collections to make clean start
    await Operator.deleteMany({});
    await Employee.deleteMany({});
    await TestReport.deleteMany({});
    await Medicine.deleteMany({});
    await AuditLog.deleteMany({});

    // 1. Create a Default Operator
    const passwordHash = await bcrypt.hash('password123', 10);
    const operator = new Operator({
      fullName: 'Sarah Connor',
      employeeId: 'EMP100',
      email: 'sarah.connor@company.com',
      mobile: '9876543210',
      passwordHash
    });
    await operator.save();
    console.log('Created Default Operator: ID=EMP100, Password=password123');

    // 2. Create 10 Sample Employees
    const employeeData = [
      { employeeNumber: 'EMP001', name: 'Ravi Kumar', designation: 'Plant Operator', workLocation: 'Plant A', age: 34, height: 172, weight: 68, pulse: 74, bp: '120/80', issue: 'Back ache', tabletsGiven: 'Aceclofenac', quantity: 6 },
      { employeeNumber: 'EMP002', name: 'Suresh Reddy', designation: 'Boiler Technician', workLocation: 'Boiler House', age: 42, height: 168, weight: 75, pulse: 78, bp: '135/85', issue: 'Mild fever', tabletsGiven: 'Paracetamol', quantity: 10 },
      { employeeNumber: 'EMP003', name: 'Priya Sharma', designation: 'HR Executive', workLocation: 'Admin Block', age: 29, height: 160, weight: 52, pulse: 70, bp: '115/75', issue: 'Headache', tabletsGiven: 'Crocin', quantity: 2 },
      { employeeNumber: 'EMP004', name: 'Anil Verma', designation: 'Loader', workLocation: 'Warehouse', age: 27, height: 170, weight: 64, pulse: 72, bp: '118/78', issue: 'Cough', tabletsGiven: 'Cough Syrup', quantity: 1 },
      { employeeNumber: 'EMP005', name: 'Kavya Rao', designation: 'Quality Controller', workLocation: 'Lab A', age: 31, height: 162, weight: 55, pulse: 71, bp: '122/81', issue: '', tabletsGiven: '', quantity: 0 },
      { employeeNumber: 'EMP006', name: 'Mahesh Kumar', designation: 'Electrician', workLocation: 'Substation', age: 38, height: 175, weight: 80, pulse: 76, bp: '130/84', issue: 'Acidity', tabletsGiven: 'Pantocid', quantity: 5 },
      { employeeNumber: 'EMP007', name: 'Deepika Singh', designation: 'Safety Officer', workLocation: 'Plant B', age: 33, height: 165, weight: 58, pulse: 73, bp: '120/79', issue: '', tabletsGiven: '', quantity: 0 },
      { employeeNumber: 'EMP008', name: 'Ramesh Naidu', designation: 'Forklift Driver', workLocation: 'Dispatch', age: 45, height: 169, weight: 78, pulse: 80, bp: '140/90', issue: 'Knee pain', tabletsGiven: 'Ibuprofen', quantity: 8 },
      { employeeNumber: 'EMP009', name: 'Lakshmi Devi', designation: 'Data Entry Clerk', workLocation: 'Logistics Office', age: 26, height: 158, weight: 50, pulse: 69, bp: '110/70', issue: 'Fatigue', tabletsGiven: 'Multivitamin', quantity: 15 },
      { employeeNumber: 'EMP010', name: 'Venkatesh Rao', designation: 'Mechanical Fitter', workLocation: 'Workshop 1', age: 50, height: 171, weight: 72, pulse: 75, bp: '128/82', issue: 'Eye irritation', tabletsGiven: 'Eye Drops', quantity: 1 }
    ];

    const employees = [];
    for (const emp of employeeData) {
      const savedEmp = new Employee(emp);
      await savedEmp.save();
      employees.push(savedEmp);

      if (emp.tabletsGiven && emp.quantity > 0) {
        const med = new Medicine({
          employeeId: savedEmp._id,
          issue: emp.issue,
          tabletsGiven: emp.tabletsGiven,
          quantity: emp.quantity,
          issuedDate: new Date()
        });
        await med.save();
      }
    }
    console.log('Successfully created 10 sample employees.');

    // 3. Create Historical Reports for EMP001 (Ravi Kumar)
    const emp001Obj = employees.find(e => e.employeeNumber === 'EMP001');
    const reportsEMP001 = [
      {
        employeeId: emp001Obj._id,
        reportNumber: 'report_1_2026-06-18',
        reportDate: new Date('2026-06-18'),
        htn: 'No',
        dm: 'No',
        rbs: '95 mg/dL',
        serumCreatinine: '0.85 mg/dL',
        serumUrea: '22 mg/dL',
        serumCholinesterase: '7800 U/L',
        serumCholesterol: '178 mg/dL',
        serumTriglycerides: '110 mg/dL',
        hdl: '48 mg/dL',
        ldl: '108 mg/dL',
        vldl: '22 mg/dL',
        totalLeucocytes: '5800 /cumm',
        erythrocyteCount: '4.6 million',
        neutrophils: '58%',
        lymphocytes: '34%',
        eosinophils: '5%',
        monocytes: '2%',
        basophils: '1%',
        esr: '10 mm/hr',
        hb: '14.2 g/dl',
        plateletCount: '2.1 lakhs',
        packedCellVolume: '41%',
        mcv: '89 fl',
        mch: '30 pg',
        mchc: '34 g/dl',
        rcdw: '13.2%',
        rbcSmear: 'Normocytic Normochromic',
        wbcSmear: 'Normal count and morphology',
        plateletSmear: 'Adequate in number',
        parasites: 'Not Seen',
        specificGravity: '1.012',
        urinePh: '6.5',
        urineAcetone: 'Nil',
        urineNitrites: 'Negative',
        ubs: 'Nil',
        ubp: 'Nil',
        urobilinogen: 'Normal',
        urineLeucocyte: 'Nil',
        urineAlbumin: 'Nil',
        urineSugar: 'Nil',
        uml: 'Nil',
        rbc: 'Nil',
        ec: '1-2 /HPF',
        casts: 'Nil',
        crystals: 'Nil',
        xrayReport: 'Chest X-Ray Normal',
        rightEar: 'Normal (15dB)',
        leftEar: 'Normal (15dB)',
        rightEye: '6/6 Vision',
        leftEye: '6/6 Vision'
      },
      {
        employeeId: emp001Obj._id,
        reportNumber: 'report_2_2026-12-20',
        reportDate: new Date('2026-12-20'),
        htn: 'No',
        dm: 'No',
        rbs: '104 mg/dL',
        serumCreatinine: '0.90 mg/dL',
        serumUrea: '25 mg/dL',
        serumCholinesterase: '8100 U/L',
        serumCholesterol: '185 mg/dL',
        serumTriglycerides: '125 mg/dL',
        hdl: '46 mg/dL',
        ldl: '114 mg/dL',
        vldl: '25 mg/dL',
        totalLeucocytes: '6100 /cumm',
        erythrocyteCount: '4.7 million',
        neutrophils: '60%',
        lymphocytes: '32%',
        eosinophils: '5%',
        monocytes: '2%',
        basophils: '1%',
        esr: '12 mm/hr',
        hb: '14.4 g/dl',
        plateletCount: '2.3 lakhs',
        packedCellVolume: '42%',
        mcv: '88 fl',
        mch: '30 pg',
        mchc: '33.8 g/dl',
        rcdw: '13.4%',
        rbcSmear: 'Normocytic Normochromic',
        wbcSmear: 'Normal count and morphology',
        plateletSmear: 'Adequate in number',
        parasites: 'Not Seen',
        specificGravity: '1.015',
        urinePh: '6.0',
        urineAcetone: 'Nil',
        urineNitrites: 'Negative',
        ubs: 'Nil',
        ubp: 'Nil',
        urobilinogen: 'Normal',
        urineLeucocyte: 'Nil',
        urineAlbumin: 'Nil',
        urineSugar: 'Nil',
        uml: 'Nil',
        rbc: 'Nil',
        ec: '2-3 /HPF',
        casts: 'Nil',
        crystals: 'Nil',
        xrayReport: 'Chest X-Ray Normal',
        rightEar: 'Normal (18dB)',
        leftEar: 'Normal (15dB)',
        rightEye: '6/6 Vision',
        leftEye: '6/6 Vision'
      },
      {
        employeeId: emp001Obj._id,
        reportNumber: 'report_3_2027-06-25',
        reportDate: new Date('2027-06-25'),
        htn: 'Yes', // Slightly elevated BP observed
        dm: 'No',
        rbs: '112 mg/dL',
        serumCreatinine: '0.94 mg/dL',
        serumUrea: '27 mg/dL',
        serumCholinesterase: '8350 U/L',
        serumCholesterol: '202 mg/dL', // High Cholesterol
        serumTriglycerides: '155 mg/dL',
        hdl: '42 mg/dL',
        ldl: '129 mg/dL',
        vldl: '31 mg/dL',
        totalLeucocytes: '6500 /cumm',
        erythrocyteCount: '4.8 million',
        neutrophils: '62%',
        lymphocytes: '30%',
        eosinophils: '4%',
        monocytes: '3%',
        basophils: '1%',
        esr: '15 mm/hr',
        hb: '14.1 g/dl',
        plateletCount: '2.5 lakhs',
        packedCellVolume: '42%',
        mcv: '87.5 fl',
        mch: '29.4 pg',
        mchc: '33.6 g/dl',
        rcdw: '13.6%',
        rbcSmear: 'Normocytic Normochromic',
        wbcSmear: 'Normal count and morphology',
        plateletSmear: 'Adequate in number',
        parasites: 'Not Seen',
        specificGravity: '1.018',
        urinePh: '6.0',
        urineAcetone: 'Nil',
        urineNitrites: 'Negative',
        ubs: 'Nil',
        ubp: 'Nil',
        urobilinogen: 'Normal',
        urineLeucocyte: 'Nil',
        urineAlbumin: 'Nil',
        urineSugar: 'Nil',
        uml: 'Nil',
        rbc: 'Nil',
        ec: '1-3 /HPF',
        casts: 'Nil',
        crystals: 'Nil',
        xrayReport: 'Chest X-Ray Normal',
        rightEar: 'Mild impairment (22dB)',
        leftEar: 'Normal (18dB)',
        rightEye: '6/6 Vision',
        leftEye: '6/6 Vision'
      }
    ];

    for (const rep of reportsEMP001) {
      const r = new TestReport(rep);
      await r.save();
    }
    console.log('Successfully created 3 historical reports for EMP001 (Ravi Kumar).');

    // 4. Create Historical Reports for EMP002 (Suresh Reddy)
    const emp002Obj = employees.find(e => e.employeeNumber === 'EMP002');
    const reportsEMP002 = [
      {
        employeeId: emp002Obj._id,
        reportNumber: 'report_1_2026-06-18',
        reportDate: new Date('2026-06-18'),
        htn: 'Yes',
        dm: 'Yes',
        rbs: '145 mg/dL',
        serumCreatinine: '1.1 mg/dL',
        serumUrea: '32 mg/dL',
        serumCholinesterase: '7200 U/L',
        serumCholesterol: '210 mg/dL',
        serumTriglycerides: '175 mg/dL',
        hdl: '38 mg/dL',
        ldl: '137 mg/dL',
        vldl: '35 mg/dL',
        totalLeucocytes: '7200 /cumm',
        erythrocyteCount: '4.4 million',
        neutrophils: '65%',
        lymphocytes: '28%',
        eosinophils: '4%',
        monocytes: '2%',
        basophils: '1%',
        esr: '18 mm/hr',
        hb: '13.5 g/dl',
        plateletCount: '2.0 lakhs',
        packedCellVolume: '40%',
        mcv: '90 fl',
        mch: '30.6 pg',
        mchc: '33.7 g/dl',
        rcdw: '13.8%',
        rbcSmear: 'Normocytic Normochromic',
        wbcSmear: 'Normal count',
        plateletSmear: 'Adequate',
        parasites: 'Not Seen',
        specificGravity: '1.020',
        urinePh: '5.5',
        urineAcetone: 'Nil',
        urineNitrites: 'Negative',
        ubs: 'Nil',
        ubp: 'Nil',
        urobilinogen: 'Normal',
        urineLeucocyte: 'Nil',
        urineAlbumin: 'Trace',
        urineSugar: '1+',
        uml: 'Nil',
        rbc: 'Nil',
        ec: '3-4 /HPF',
        casts: 'Nil',
        crystals: 'Nil',
        xrayReport: 'Chest X-Ray Normal',
        rightEar: 'Normal (18dB)',
        leftEar: 'Normal (20dB)',
        rightEye: '6/9 Vision',
        leftEye: '6/9 Vision'
      },
      {
        employeeId: emp002Obj._id,
        reportNumber: 'report_2_2026-12-20',
        reportDate: new Date('2026-12-20'),
        htn: 'Yes',
        dm: 'Yes',
        rbs: '130 mg/dL',
        serumCreatinine: '1.05 mg/dL',
        serumUrea: '29 mg/dL',
        serumCholinesterase: '7400 U/L',
        serumCholesterol: '198 mg/dL',
        serumTriglycerides: '160 mg/dL',
        hdl: '40 mg/dL',
        ldl: '126 mg/dL',
        vldl: '32 mg/dL',
        totalLeucocytes: '6800 /cumm',
        erythrocyteCount: '4.5 million',
        neutrophils: '62%',
        lymphocytes: '30%',
        eosinophils: '5%',
        monocytes: '2%',
        basophils: '1%',
        esr: '15 mm/hr',
        hb: '13.8 g/dl',
        plateletCount: '2.1 lakhs',
        packedCellVolume: '41%',
        mcv: '91 fl',
        mch: '30.7 pg',
        mchc: '33.7 g/dl',
        rcdw: '13.7%',
        rbcSmear: 'Normocytic Normochromic',
        wbcSmear: 'Normal count',
        plateletSmear: 'Adequate',
        parasites: 'Not Seen',
        specificGravity: '1.018',
        urinePh: '6.0',
        urineAcetone: 'Nil',
        urineNitrites: 'Negative',
        ubs: 'Nil',
        ubp: 'Nil',
        urobilinogen: 'Normal',
        urineLeucocyte: 'Nil',
        urineAlbumin: 'Nil',
        urineSugar: 'Nil',
        uml: 'Nil',
        rbc: 'Nil',
        ec: '2-3 /HPF',
        casts: 'Nil',
        crystals: 'Nil',
        xrayReport: 'Chest X-Ray Normal',
        rightEar: 'Normal (18dB)',
        leftEar: 'Normal (18dB)',
        rightEye: '6/9 Vision',
        leftEye: '6/6 Vision'
      }
    ];

    for (const rep of reportsEMP002) {
      const r = new TestReport(rep);
      await r.save();
    }
    console.log('Successfully created 2 historical reports for EMP002 (Suresh Reddy).');

    // Create a dummy audit log
    const audit = new AuditLog({
      action: 'Initialized database with sample datasets (10 employees).'
    });
    await audit.save();

  } catch (err) {
    console.error('Initialization error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

run();
