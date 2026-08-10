// Helper to calculate dynamic grades based on class/section grading systems
const computeDynamicGrade = (score, className, section, gradingSystems) => {
  if (!gradingSystems || gradingSystems.length === 0) {
    if (score >= 75) return { grade: 'A1', remark: 'Excellent' };
    if (score >= 70) return { grade: 'B2', remark: 'Very Good' };
    if (score >= 65) return { grade: 'B3', remark: 'Good' };
    if (score >= 60) return { grade: 'C4', remark: 'Credit' };
    if (score >= 55) return { grade: 'C5', remark: 'Credit' };
    if (score >= 50) return { grade: 'C6', remark: 'Credit' };
    if (score >= 45) return { grade: 'D7', remark: 'Pass' };
    if (score >= 40) return { grade: 'E8', remark: 'Pass' };
    return { grade: 'F9', remark: 'Fail' };
  }

  let matchedSystem = null;
  if (className) {
    matchedSystem = gradingSystems.find(gs => 
      gs.targetClasses && Array.isArray(gs.targetClasses) && 
      gs.targetClasses.some(c => c.toLowerCase().trim() === className.toLowerCase().trim())
    );
  }
  if (!matchedSystem && section && section !== 'both') {
    matchedSystem = gradingSystems.find(gs => 
      (!gs.targetClasses || gs.targetClasses.length === 0) && 
      gs.targetSection && gs.targetSection.toLowerCase() === section.toLowerCase()
    );
  }
  if (!matchedSystem) {
    matchedSystem = gradingSystems.find(gs => 
      (!gs.targetClasses || gs.targetClasses.length === 0) && 
      (!gs.targetSection || gs.targetSection.toLowerCase() === 'both' || gs.targetSection === '')
    );
  }
  if (!matchedSystem) matchedSystem = gradingSystems[0];
  
  if (!matchedSystem.rules || !Array.isArray(matchedSystem.rules) || matchedSystem.rules.length === 0) {
    return { grade: 'F', remark: 'Fail' };
  }
  
  for (const rule of matchedSystem.rules) {
    if (score >= Number(rule.min) && score <= Number(rule.max)) {
      return { grade: rule.grade || 'F', remark: rule.remark || '' };
    }
  }
  
  let lowest = matchedSystem.rules[matchedSystem.rules.length - 1];
  return { grade: lowest.grade || 'F', remark: lowest.remark || '' };
};

module.exports = function(db) {

  // Utility function to ensure a parent is authorized to view a specific child
  async function verifyParentChild(parentUserId, studentId) {
    if (!studentId) throw new Error("Student ID is required.");
    const studentDoc = await db.collection("students").doc(studentId).get();
    if (!studentDoc.exists) throw new Error("Student not found.");
    
    const studentData = studentDoc.data();
    if (studentData.parentId !== parentUserId) {
      throw new Error("Unauthorized access to student data.");
    }
    return true;
  }

  return {
    parentGetChildren: async (req, res) => {
      const session = req.session;
      
      try {
        const studentsSnap = await db.collection("students")
          .where("parentId", "==", session.userId)
          .get();
          
        const children = [];
        studentsSnap.forEach(doc => {
          let s = doc.data();
          s.id = doc.id;
          children.push(s);
        });
        
        return res.json({ success: true, data: children });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching children: " + err.message });
      }
    },

    parentGetReport: async (req, res) => {
      const { studentId, term, session: academicSession, reportType } = req.body;
      const session = req.session;
      
      try {
        await verifyParentChild(session.userId, studentId);
        
        const studentDoc = await db.collection("students").doc(studentId).get();
        if (!studentDoc.exists) return res.json({ success: false, message: "Student not found." });
        
        let student = studentDoc.data();
        student.id = studentDoc.id;

        const settingsSnap = await db.collection("settings").doc("global").get();
        const cfg = settingsSnap.exists ? settingsSnap.data() : {};
        if (term === cfg.current_term && academicSession === cfg.current_session && !cfg.results_published) {
          return res.json({ success: false, message: "Results for the current term have not been published yet." });
        }
        
        const scoresSnap = await db.collection("assessments")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", academicSession)
          .get();
          
        const scores = [];
        let totalSum = 0;
        
        scoresSnap.forEach(doc => {
          let s = doc.data();
          s.id = doc.id;
          // Only show finalized or locked scores to parents, or all based on reportType
          // Assuming we show all for this chunk
          scores.push(s);
          totalSum += (parseFloat(s.total) || 0);
        });
        
        const avg = scores.length > 0 ? Math.round((totalSum / scores.length) * 10) / 10 : 0;
        
        const gradingSnap = await db.collection("gradingSystems").get();
        const gradingSystems = gradingSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const className = student.className || "";
        const section = student.section || "";
        const overallGradeObj = computeDynamicGrade(avg, className, section, gradingSystems);

        return res.json({ 
          success: true, 
          student: student, 
          scores: scores,
          summary: { 
            totalSubjects: scores.length, 
            totalScore: totalSum, 
            average: avg, 
            overallGrade: overallGradeObj.grade 
          } 
        });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentGetBills: async (req, res) => {
      const { studentId } = req.body;
      const session = req.session;
      
      try {
        await verifyParentChild(session.userId, studentId);
        
        const billsSnap = await db.collection("bills").where("studentId", "==", studentId).get();
        const bills = [];
        billsSnap.forEach(doc => {
          let b = doc.data();
          b.id = doc.id;
          bills.push(b);
        });
        // Compute paid amount and balance per term/session
        const paymentsSnap = await db.collection("payments").where("studentId", "==", studentId).where("status", "==", "Approved").get();
        const paidMap = {};
        paymentsSnap.forEach(doc => {
          const p = doc.data();
          const term = p.term || '';
          const sess = p.session || '';
          const key = term + "_" + sess;
          paidMap[key] = (paidMap[key] || 0) + Number(p.amount || 0);
        });

        const enriched = bills.map(b => {
          const key = (b.term || '') + "_" + (b.session || '');
          const totalPaid = paidMap[key] || 0;
          const netBilled = Number(b.totalBilled || 0);
          const balance = Math.max(0, netBilled - totalPaid);
          const status = balance === 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid');
          return { ...b, totalPaid, balance, status };
        });
        
        return res.json({ success: true, data: enriched });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentGetPayments: async (req, res) => {
      const { studentId } = req.body;
      const session = req.session;
      
      try {
        await verifyParentChild(session.userId, studentId);
        
        const paymentsSnap = await db.collection("payments").where("studentId", "==", studentId).get();
        const payments = [];
        paymentsSnap.forEach(doc => {
          let p = doc.data();
          p.id = doc.id;
          payments.push(p);
        });
        
        return res.json({ success: true, data: payments });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentDownloadReport: async (req, res) => {
      const { studentId, term, session: academicSession, reportType } = req.body;
      const session = req.session;
      
      try {
        await verifyParentChild(session.userId, studentId);
        
        const studentDoc = await db.collection("students").doc(studentId).get();
        if (!studentDoc.exists) return res.json({ success: false, message: "Student not found." });
        let student = studentDoc.data();
        student.id = studentDoc.id;
        
        const settingsSnap = await db.collection("settings").doc("global").get();
        const cfg = settingsSnap.exists ? settingsSnap.data() : {};
        if (term === cfg.current_term && academicSession === cfg.current_session && !cfg.results_published) {
          return res.json({ success: false, message: "Results for the current term have not been published yet." });
        }
        
        const scoresSnap = await db.collection("assessments")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", academicSession)
          .get();
          
        const scores = [];
        let totalSum = 0;
        scoresSnap.forEach(doc => {
          let s = doc.data();
          s.id = doc.id;
          scores.push(s);
          totalSum += (parseFloat(s.total) || 0);
        });
        
        const avg = scores.length > 0 ? Math.round((totalSum / scores.length) * 10) / 10 : 0;
        
        // Fetch behavioral traits and grading
        const [psySnap, affSnap, gradingSnap] = await Promise.all([
          db.collection("psychomotorRecords").where("studentId", "==", studentId).where("term", "==", term).where("session", "==", academicSession).get(),
          db.collection("affectiveRecords").where("studentId", "==", studentId).where("term", "==", term).where("session", "==", academicSession).get(),
          db.collection("gradingSystems").get()
        ]);
        
        const gradingSystems = gradingSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const className = student.className || "";
        const section = student.section || "";
        const overallGradeObj = computeDynamicGrade(avg, className, section, gradingSystems);
        
        const report = {
          student: student,
          scores: scores,
          summary: { average: avg, overallGrade: overallGradeObj.grade },
          attendance: { percentage: 95 }, // Mock for now
          psychomotor: psySnap.empty ? {} : psySnap.docs[0].data(),
          affective: affSnap.empty ? {} : affSnap.docs[0].data(),
          term: term,
          session: academicSession,
          reportType: reportType
        };
        
        const pdfGenerator = require("./pdf");
        const { enrichReportData } = require("./reportUtil");
        await enrichReportData(db, report, cfg);

        const html = pdfGenerator.generateStudentReportHTML(report, cfg);
        const dataUri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        
        return res.json({ success: true, previewUrl: dataUri, downloadUrl: dataUri });
      } catch (err) {
        return res.json({ success: false, message: "Error downloading report: " + err.message });
      }
    },

    parentGenerateIDCard: async (req, res) => {
      const { studentId } = req.body;
      const session = req.session;
      try {
        await verifyParentChild(session.userId, studentId);
        
        const studentDoc = await db.collection("students").doc(studentId).get();
        if (!studentDoc.exists) return res.json({ success: false, message: "Student not found." });
        const student = studentDoc.data();
        
        const cfgDoc = await db.collection("settings").doc("global").get();
        const cfg = cfgDoc.exists ? cfgDoc.data() : { schoolName: "MySchool Portal" };
        
        const pdfGenerator = require("./pdf");
        const html = pdfGenerator.generateStudentIdCardHTML(student, cfg);
        const dataUri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        
        return res.json({ success: true, previewUrl: dataUri, downloadUrl: dataUri });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentGetStudentCredit: async (req, res) => {
      const { studentId } = req.body;
      const session = req.session;
      try {
        await verifyParentChild(session.userId, studentId);
        // Returns 0 credit for now as it's just a stub
        return res.json(0); 
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentSubmitPaymentData: async (req, res) => {
      const { data } = req.body;
      const session = req.session;
      try {
        if (!data || !data.studentId) throw new Error("Student ID missing.");
        if (!data.amount || Number(data.amount) <= 0) throw new Error("Please enter a valid amount.");
        if (data.method !== 'Cash' && !data.proofOfPayment) throw new Error("Proof of payment is required.");

        // Verify parent is linked to this student
        await verifyParentChild(session.userId, data.studentId);

        // Fetch student name and class to store with payment
        const studentDoc = await db.collection("students").doc(data.studentId).get();
        if (!studentDoc.exists) throw new Error("Student not found.");
        const student = studentDoc.data();

        const paymentData = {
          studentId: data.studentId,
          studentName: student.fullName || (student.firstName + ' ' + student.lastName),
          className: student.className || student.class || '',
          amount: Number(data.amount),
          method: data.method || 'Bank Transfer',
          proofOfPayment: data.proofOfPayment,
          term: data.term,
          session: data.session,
          status: "Pending",  // Needs approval from accounts
          submittedBy: session.userId,
          submittedByRole: "parent",
          paymentDate: new Date().toISOString(),
          date: new Date().toISOString()
        };

        await db.collection("payments").add(paymentData);

        return res.json({ success: true, message: "Payment submitted successfully. It will appear on your ledger once approved by the accounts office." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    parentDownloadReceipt: async (req, res) => {
      const { paymentId } = req.body;
      try {
        if (!paymentId) return res.json({ success: false, message: "Payment ID required." });
        const payDoc = await db.collection("payments").doc(paymentId).get();
        if (!payDoc.exists) return res.json({ success: false, message: "Payment not found." });
        const p = payDoc.data();
        if (p.status !== "Approved") return res.json({ success: false, message: "Receipt is only available for approved payments." });

        const settingsDoc = await db.collection("settings").doc("global").get();
        const settings = settingsDoc.data() || {};
        const receiptNo = payDoc.id.slice(-8).toUpperCase();

        let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
          <style>
            body{font-family:"Times New Roman",serif;margin:0;padding:20px;color:#1a1a1a;}
            .wrap{max-width:700px;margin:0 auto;border:3px double #0d1b2a;padding:20px;}
            .hdr{display:flex;align-items:center;border-bottom:2px solid #0d1b2a;padding-bottom:12px;margin-bottom:16px;}
            .school-name{font-size:20px;font-weight:bold;text-transform:uppercase;color:#0d1b2a;}
            .title-badge{background:#0d1b2a;color:#f0a500;padding:4px 16px;font-size:13px;font-weight:bold;text-transform:uppercase;display:inline-block;margin-top:8px;}
            table{width:100%;border-collapse:collapse;margin:16px 0;}
            th{background:#0d1b2a;color:#f0a500;padding:6px 10px;border:1px solid #0d1b2a;}
            td{padding:6px 10px;border:1px solid #ccc;}
            tr:nth-child(even){background:#f8f8f8;}
            .total-row td{font-weight:bold;font-size:14px;background:#e8f5e9;}
            .footer{text-align:center;margin-top:20px;font-size:10px;color:#888;border-top:1px solid #e0e0e0;padding-top:10px;}
          </style>
        </head><body><div class="wrap">
          <div class="hdr">
            <div style="width:60px;height:60px;background:#0d1b2a;display:flex;align-items:center;justify-content:center;color:#f0a500;font-weight:bold;font-size:14px;margin-right:15px;">Logo</div>
            <div>
              <div class="school-name">${settings.school_name || 'MySchool Portal'}</div>
              <div class="title-badge">Official Payment Receipt</div>
            </div>
          </div>
          <table>
            <tr><th colspan="2" style="text-align:left;">Receipt Details</th></tr>
            <tr><td>Receipt No</td><td><strong>${receiptNo}</strong></td></tr>
            <tr><td>Student Name</td><td>${p.studentName || '-'}</td></tr>
            <tr><td>Class</td><td>${p.className || '-'}</td></tr>
            <tr><td>Term / Session</td><td>${p.term || '-'} / ${p.session || '-'}</td></tr>
            <tr><td>Payment Method</td><td>${p.method || 'Bank Transfer'}</td></tr>
            <tr><td>Date Approved</td><td>${new Date(p.approvedAt || p.date || Date.now()).toLocaleDateString()}</td></tr>
            <tr class="total-row"><td>Amount Paid</td><td style="color:#16a34a;font-size:16px;">\u20a6${Number(p.amount || 0).toLocaleString()}</td></tr>
          </table>
          <p style="margin-top:20px;">This receipt confirms that the above payment has been received and approved by the accounts office.</p>
          <div class="footer">Generated on ${new Date().toLocaleString()} &mdash; ${settings.school_name || 'MySchool Portal'}</div>
        </div></body></html>`;

        const dataUri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        return res.json({ success: true, previewUrl: dataUri });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }
  };
};
