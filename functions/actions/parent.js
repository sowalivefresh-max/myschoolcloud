const { FieldPath } = require("firebase-admin/firestore");

module.exports = function(db) {

  // Utility to verify a parent has access to a student
  async function verifyParentChild(parentUserId, studentId) {
    const parentDoc = await db.collection("users").doc(parentUserId).get();
    if (!parentDoc.exists) throw new Error("Parent not found.");
    
    const parentData = parentDoc.data();
    const linkedIds = parentData.linkedStudentIds ? String(parentData.linkedStudentIds).split(',').map(id => id.trim()) : [];
    
    if (!linkedIds.includes(String(studentId))) {
      throw new Error("Unauthorized access to student data.");
    }
    return true;
  }

  // Basic utility to map average score to grade (similar to Code.gs)
  function computeGrade(avg) {
    if (avg >= 70) return 'A';
    if (avg >= 60) return 'B';
    if (avg >= 50) return 'C';
    if (avg >= 40) return 'D';
    if (avg >= 0)  return 'F';
    return '';
  }

  return {
    parentGetChildren: async (req, res) => {
      const session = req.session;
      
      try {
        const parentDoc = await db.collection("users").doc(session.userId).get();
        const parentData = parentDoc.data();
        
        if (!parentData.linkedStudentIds) {
          return res.json({ success: true, data: [] });
        }
        
        const linkedIds = String(parentData.linkedStudentIds).split(',').map(id => id.trim()).filter(Boolean);
        if (linkedIds.length === 0) return res.json({ success: true, data: [] });
        
        // Firestore 'in' queries are limited to 10 elements. 
        // For a parent, it's highly unlikely they have more than 10 children in the school.
        const studentsSnap = await db.collection("students")
          .where(FieldPath.documentId(), "in", linkedIds)
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
        
        return res.json({ 
          success: true, 
          student: student, 
          scores: scores,
          summary: { 
            totalSubjects: scores.length, 
            totalScore: totalSum, 
            average: avg, 
            overallGrade: computeGrade(avg) 
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
        
        return res.json({ success: true, data: bills });
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
        
        // Fetch behavioral traits
        const [psySnap, affSnap] = await Promise.all([
          db.collection("psychomotorRecords").where("studentId", "==", studentId).where("term", "==", term).where("session", "==", academicSession).get(),
          db.collection("affectiveRecords").where("studentId", "==", studentId).where("term", "==", term).where("session", "==", academicSession).get()
        ]);
        
        const report = {
          student: student,
          scores: scores,
          summary: { average: avg, overallGrade: computeGrade(avg) },
          attendance: { percentage: 95 }, // Mock for now
          psychomotor: psySnap.empty ? {} : psySnap.docs[0].data(),
          affective: affSnap.empty ? {} : affSnap.docs[0].data(),
          term: term,
          session: academicSession,
          reportType: reportType
        };
        
        const cfgDoc = await db.collection("settings").doc("global").get();
        const cfg = cfgDoc.exists ? cfgDoc.data() : { schoolName: "MySchool Portal" };

        const pdfGenerator = require("./pdf");
        const html = pdfGenerator.generateStudentReportHTML(report, cfg);
        
        return res.json({ success: true, html: html, fileName: `${student.fullName}_${term}_Report.pdf` });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }
  };
};
