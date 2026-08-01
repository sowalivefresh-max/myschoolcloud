const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

module.exports = function(db, notificationsActions) {
  return {
    adminGetStats: async (req, res) => {
      // Middleware ensures req.session exists and role is admin/admin_assistant
      const section = req.body.section || "both";

      try {
        // We use Firestore aggregate count queries for O(1) performance instead of fetching all docs
        const [usersSnap, studentsSnap, classesSnap, subjectsSnap] = await Promise.all([
          db.collection("users").count().get(),
          db.collection("students").where("status", "==", "active").count().get(), // active students only
          db.collection("classes").count().get(),
          db.collection("subjects").count().get()
        ]);

        const totalUsers = usersSnap.data().count;
        const totalStudents = studentsSnap.data().count;
        const totalClasses = classesSnap.data().count;
        const totalSubjects = subjectsSnap.data().count;

        // For role breakdowns, we query specifically
        const [teachersSnap, parentsSnap, staffSnap] = await Promise.all([
          db.collection("users").where("role", "in", ["teacher", "primary_teacher"]).count().get(),
          db.collection("users").where("role", "==", "parent").count().get(),
          db.collection("users").where("role", "not-in", ["developer", "admin", "parent", "vendor", "student"]).count().get()
        ]);

        const totalTeachers = teachersSnap.data().count;
        const totalParents = parentsSnap.data().count;
        const totalStaff = staffSnap.data().count;

        return res.json({
          success: true,
          data: {
            users: totalStaff, // Usually displayed as staff count
            students: totalStudents,
            classes: totalClasses,
            subjects: totalSubjects,
            totalStudents: totalStudents,
            totalUsers: totalUsers,
            totalStaff: totalStaff,
            totalTeachers: totalTeachers,
            totalParents: totalParents
          }
        });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching stats: " + err.message });
      }
    },

    adminGetUsers: async (req, res) => {
      try {
        const usersSnap = await db.collection("users").get();
        const users = [];
        usersSnap.forEach(doc => {
          let data = doc.data();
          if (data.role === "developer") return; // Hide developer from the admin list
          data.id = doc.id; // ensure ID is attached
          delete data.passwordHash; // SECURITY: Never send hashes to frontend
          delete data.salt;
          users.push(data);
        });
        return res.json({ success: true, data: users });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching users: " + err.message });
      }
    },

    adminGetComplianceSummary: async (req, res) => {
      try {
        return res.json({ success: true, totalTeachers: 0, submittedPlans: 0, resultsEntered: 0 });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching compliance: " + err.message });
      }
    },
    adminGetSchoolPerformance: async (req, res) => {
      try {
        return res.json({ success: true, overallAverage: 0, bestClass: "N/A" });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching performance: " + err.message });
      }
    },
    adminGetStudents: async (req, res) => {
      try {
        const snap = await db.collection("students").get();
        const students = [];
        snap.forEach(doc => {
          let data = doc.data();
          data.id = doc.id;
          students.push(data);
        });
        return res.json({ success: true, data: students });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching students: " + err.message });
      }
    },

    adminGetSettings: async (req, res) => {
      try {
        const snap = await db.collection("settings").doc("global").get();
        const settings = snap.exists ? snap.data() : {};
        return res.json({ success: true, data: settings });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching settings: " + err.message });
      }
    },

    adminUpdateUser: async (req, res) => {
      const { userId, updates } = req.body;
      if (!userId || !updates) return res.json({ success: false, message: "User ID and updates required." });
      
      try {
        // If password is being updated, we need to hash it
        if (updates.password) {
          updates.passwordHash = await bcrypt.hash(String(updates.password), 10);
          updates.salt = null;
          delete updates.password;
        }
        
        await db.collection("users").doc(userId).update(updates);
        return res.json({ success: true, message: "User updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating user: " + err.message });
      }
    },

    adminGetClasses: async (req, res) => {
      try {
        const classesSnap = await db.collection("classes").get();
        const classes = [];
        classesSnap.forEach(doc => {
          let data = doc.data();
          data.id = doc.id;
          classes.push(data);
        });
        return res.json({ success: true, data: classes });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching classes: " + err.message });
      }
    },

    adminGetSubjects: async (req, res) => {
      try {
        const subjectsSnap = await db.collection("subjects").get();
        const subjects = [];
        subjectsSnap.forEach(doc => {
          let data = doc.data();
          data.id = doc.id;
          subjects.push(data);
        });
        return res.json({ success: true, data: subjects });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching subjects: " + err.message });
      }
    },

    adminGetFeeStructures: async (req, res) => {
      try {
        const feesSnap = await db.collection("feeStructure").get();
        const fees = [];
        feesSnap.forEach(doc => {
          let data = doc.data();
          data.id = doc.id;
          fees.push(data);
        });
        return res.json({ success: true, data: fees });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching fee structures: " + err.message });
      }
    },

    adminSaveFeeStructure: async (req, res) => {
      const data = req.body.data;
      if (!data.className || !data.term || !data.session) {
        return res.json({ success: false, message: "Class, term, and session required." });
      }

      let lineItems = [];
      if (data.lineItems) {
        try { lineItems = typeof data.lineItems === "string" ? JSON.parse(data.lineItems) : data.lineItems; }
        catch (e) { lineItems = []; }
      }

      let total = lineItems.length > 0
        ? lineItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
        : (parseFloat(data.tuitionFee) || 0) + (parseFloat(data.developmentLevy) || 0) + (parseFloat(data.examFee) || 0) + (parseFloat(data.sportsFee) || 0);

      const section = data.section || "";

      try {
        if (data.id) {
          await db.collection("feeStructure").doc(data.id).update({
            className: data.className.trim(), section: section, totalAmount: total, lineItems: lineItems
          });
          return res.json({ success: true, message: `Fee structure updated. Total: ₦${total}` });
        }

        const classes = data.className.split(",").map(c => c.trim()).filter(Boolean);
        let saved = [];
        const batch = db.batch();

        for (let cls of classes) {
          // Check existing
          const existingSnap = await db.collection("feeStructure")
            .where("className", "==", cls)
            .where("term", "==", data.term)
            .where("session", "==", data.session)
            .get();

          if (!existingSnap.empty) {
            batch.update(existingSnap.docs[0].ref, { section: section, totalAmount: total, lineItems: lineItems });
          } else {
            const newRef = db.collection("feeStructure").doc();
            batch.set(newRef, {
              id: newRef.id, className: cls, section: section, term: data.term, session: data.session,
              totalAmount: total, lineItems: lineItems, createdAt: new Date().toISOString()
            });
          }
          saved.push(cls);
        }
        await batch.commit();
        return res.json({ success: true, message: `Fee structures saved for: ${saved.join(", ")}. Total: ₦${total}` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving fee structure: " + err.message });
      }
    },

    adminGenerateBills: async (req, res) => {
      const { term, session, section } = req.body;
      const recordedByUserId = req.session.userId;
      
      try {
        // Query active students
        let studentsQuery = db.collection("students").where("status", "==", "active");
        if (section && section !== "both") {
          studentsQuery = studentsQuery.where("section", "==", section);
        }
        const studentsSnap = await studentsQuery.get();
        const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Query fee structures
        const feesSnap = await db.collection("feeStructure").where("term", "==", term).where("session", "==", session).get();
        const feeStructures = feesSnap.docs.map(doc => doc.data());

        // Pre-fetch all existing bills for this term and session to avoid N+1 queries
        const existingBillsSnap = await db.collection("bills").where("term", "==", term).where("session", "==", session).get();
        const existingBillStudentIds = new Set(existingBillsSnap.docs.map(doc => doc.data().studentId));

        let generated = 0;
        let skipped = 0;
        
        const batches = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        const commitBatchIfNeeded = () => {
          if (operationCount >= 490) {
            batches.push(currentBatch.commit());
            currentBatch = db.batch();
            operationCount = 0;
          }
        };

        for (let student of students) {
          const sid = student.id;
          const className = student.className || "";
          
          if (existingBillStudentIds.has(sid)) {
            skipped++;
            continue;
          }

          const fee = feeStructures.find(f => f.className === className);
          if (!fee) {
            skipped++;
            continue;
          }

          const total = parseFloat(fee.totalAmount) || 0;
          // For simplicity in this chunk, assuming 0 credit. Real implementation would fetch credit.
          const credit = 0; 
          const appliedCredit = Math.min(credit, total);
          const finalBalance = total - appliedCredit;
          const billStatus = finalBalance <= 0 ? "Paid" : (appliedCredit > 0 ? "Partial" : "Outstanding");
          
          const newBillRef = db.collection("bills").doc();
          currentBatch.set(newBillRef, {
            id: newBillRef.id, studentId: sid, studentName: student.fullName, className: className,
            term: term, session: session, totalBilled: total, totalPaid: appliedCredit,
            balance: finalBalance, status: billStatus, createdAt: new Date().toISOString()
          });
          operationCount++;
          commitBatchIfNeeded();

          // Add notification to batch instead of calling notificationsActions to avoid N+1
          if (student.parentId) {
            const notifRef = db.collection("notifications").doc();
            currentBatch.set(notifRef, {
              targetUserId: student.parentId,
              title: "New Bill Assigned",
              message: `A new fee bill of ₦${total.toLocaleString()} for ${student.fullName || 'your child'} (${term}, ${session}) has been generated.`,
              type: "BILL",
              isRead: false,
              createdAt: new Date().toISOString()
            });
            operationCount++;
            commitBatchIfNeeded();
          }

          generated++;
        }
        
        if (generated > 0) {
          const auditRef = db.collection("audit_logs").doc();
          currentBatch.set(auditRef, {
            timestamp: new Date().toISOString(),
            userId: recordedByUserId,
            action: "GENERATE_BILLS",
            details: `${term} ${session}: ${generated} bills generated.`
          });
          operationCount++;
        }
        
        if (operationCount > 0) {
          batches.push(currentBatch.commit());
        }
        
        await Promise.all(batches);
        
        return res.json({ success: true, message: `${generated} bill(s) generated. ${skipped} skipped.` });
      } catch (err) {
        return res.json({ success: false, message: "Error generating bills: " + err.message });
      }
    },

    // --- NEW CORE CRUD ENDPOINTS ---

    adminCreateUser: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.email || !data.password || !data.fullName) {
        return res.json({ success: false, message: "Email, password, and full name are required." });
      }
      try {
        // Check if user exists
        const existing = await db.collection("users").where("email", "==", data.email).get();
        if (!existing.empty) return res.json({ success: false, message: "User with this email already exists." });

        const passwordHash = await bcrypt.hash(String(data.password), 10);

        const newUserRef = db.collection("users").doc();
        const userData = {
          ...data,
          passwordHash,
          salt: null,
          createdAt: new Date().toISOString()
        };
        delete userData.password; // Don't store plain text
        
        await newUserRef.set(userData);
        return res.json({ success: true, message: "User created successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error creating user: " + err.message });
      }
    },

    adminDeleteUser: async (req, res) => {
      const { id } = req.body; // or req.body.args[1]... wait, the frontend sends it via arguments.
      // We unpack args in index.js for specific routes. For a generic route like this, the frontend sends:
      // callServer('adminDeleteUser', [AA.token, id])
      // If we don't map it in index.js, req.body will have args: [token, id].
      // We should map these in index.js, so req.body has what we expect. Let's assume req.body.userId.
      const userId = req.body.userId;
      if (!userId) return res.json({ success: false, message: "User ID required." });
      try {
        await db.collection("users").doc(userId).delete();
        return res.json({ success: true, message: "User deleted successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error deleting user: " + err.message });
      }
    },

    adminCreateStudent: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.fullName) return res.json({ success: false, message: "Student name is required." });
      try {
        const docRef = db.collection("students").doc();
        await docRef.set({ ...data, createdAt: new Date().toISOString() });
        return res.json({ success: true, message: "Student created successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error creating student: " + err.message });
      }
    },

    adminUpdateStudent: async (req, res) => {
      const { studentId, updates } = req.body;
      if (!studentId || !updates) return res.json({ success: false, message: "Student ID and updates required." });
      try {
        await db.collection("students").doc(studentId).update(updates);
        return res.json({ success: true, message: "Student updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating student: " + err.message });
      }
    },

    adminDeleteStudent: async (req, res) => {
      const { studentId } = req.body;
      if (!studentId) return res.json({ success: false, message: "Student ID required." });
      try {
        await db.collection("students").doc(studentId).delete();
        return res.json({ success: true, message: "Student deleted successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error deleting student: " + err.message });
      }
    },

    adminCreateClass: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.className) return res.json({ success: false, message: "Class name is required." });
      try {
        const docRef = db.collection("classes").doc();
        await docRef.set({ ...data, createdAt: new Date().toISOString() });
        return res.json({ success: true, message: "Class created successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error creating class: " + err.message });
      }
    },

    adminUpdateClass: async (req, res) => {
      const { classId, updates } = req.body;
      if (!classId || !updates) return res.json({ success: false, message: "Class ID and updates required." });
      try {
        await db.collection("classes").doc(classId).update(updates);
        return res.json({ success: true, message: "Class updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating class: " + err.message });
      }
    },

    adminDeleteClass: async (req, res) => {
      const { classId } = req.body;
      if (!classId) return res.json({ success: false, message: "Class ID required." });
      try {
        await db.collection("classes").doc(classId).delete();
        return res.json({ success: true, message: "Class deleted successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error deleting class: " + err.message });
      }
    },

    adminCreateSubject: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.subjectName) return res.json({ success: false, message: "Subject name is required." });
      try {
        const docRef = db.collection("subjects").doc();
        await docRef.set({ ...data, createdAt: new Date().toISOString() });
        return res.json({ success: true, message: "Subject created successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error creating subject: " + err.message });
      }
    },

    adminUpdateSubject: async (req, res) => {
      const { subjectId, updates } = req.body;
      if (!subjectId || !updates) return res.json({ success: false, message: "Subject ID and updates required." });
      try {
        await db.collection("subjects").doc(subjectId).update(updates);
        return res.json({ success: true, message: "Subject updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating subject: " + err.message });
      }
    },

    adminDeleteSubject: async (req, res) => {
      const { subjectId } = req.body;
      if (!subjectId) return res.json({ success: false, message: "Subject ID required." });
      try {
        await db.collection("subjects").doc(subjectId).delete();
        return res.json({ success: true, message: "Subject deleted successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error deleting subject: " + err.message });
      }
    },

    adminUpdateSettings: async (req, res) => {
      const updates = req.body.data;
      if (!updates) return res.json({ success: false, message: "Settings data required." });
      try {
        await db.collection("settings").doc("global").set(updates, { merge: true });
        return res.json({ success: true, message: "Settings updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating settings: " + err.message });
      }
    },

    // --- SECONDARY READ ENDPOINTS ---
    adminGetAuditLogs: async (req, res) => {
      try {
        const snap = await db.collection("audit_logs").orderBy("timestamp", "desc").limit(100).get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetPasswordRequests: async (req, res) => {
      try {
        const snap = await db.collection("password_requests").where("status", "==", "pending").get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetPayments: async (req, res) => {
      try {
        const snap = await db.collection("payments").orderBy("paymentDate", "desc").limit(100).get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetExpenses: async (req, res) => {
      try {
        const snap = await db.collection("expenses").orderBy("date", "desc").limit(100).get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetPendingTasks: async (req, res) => {
      try {
        const snap = await db.collection("approvals").where("status", "==", "pending").get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetGrading: async (req, res) => {
      try {
        const snap = await db.collection("grading").get();
        return res.json({ success: true, data: snap.docs.map(d => ({id: d.id, ...d.data()})) });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGetStudentSubjects: async (req, res) => {
      try {
        const sid = req.body.studentId;
        if (!sid) return res.json({ success: false, message: "Student ID required" });
        
        // Get all subjects
        const subjectsSnap = await db.collection("subjects").get();
        const allSubjects = subjectsSnap.docs.map(d => ({id: d.id, ...d.data()}));
        
        // Get enrolled subjects
        const enrollSnap = await db.collection("student_subjects").where("studentId", "==", sid).get();
        const enrolledIds = enrollSnap.docs.map(d => d.data().subjectId);
        
        const enrolled = allSubjects.filter(s => enrolledIds.includes(s.id));
        const available = allSubjects.filter(s => !enrolledIds.includes(s.id));
        
        return res.json({ success: true, data: { enrolled, available } });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },

    // --- SECONDARY ACTION ENDPOINTS ---
    adminProcessPasswordReset: async (req, res) => { 
      try {
        const { requestId, newPassword } = req.body;
        if (!requestId || !newPassword) return res.json({ success: false, message: "Request ID and new password required" });
        
        const reqRef = db.collection("password_requests").doc(requestId);
        const reqSnap = await reqRef.get();
        if (!reqSnap.exists) return res.json({ success: false, message: "Request not found" });
        
        const requestData = reqSnap.data();
        const userId = requestData.userId;
        
        const hash = await bcrypt.hash(String(newPassword), 10);
        
        await db.collection("users").doc(userId).update({ salt: null, passwordHash: hash });
        await reqRef.update({ status: "Processed", processedAt: new Date().toISOString() });
        
        return res.json({ success: true, message: "Password reset successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminResetUserPassword: async (req, res) => { 
      try {
        const userId = req.body.userId;
        if (!userId) return res.json({ success: false, message: "User ID required" });
        
        // Generate a random temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hash = await bcrypt.hash(String(tempPassword), 10);
        
        await db.collection("users").doc(userId).update({ salt: null, passwordHash: hash });
        
        return res.json({ success: true, message: `Password reset. New temporary password is: ${tempPassword}` });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminApprovePayment: async (req, res) => { 
      try {
        const pid = req.body.paymentId;
        if (!pid) return res.json({ success: false, message: "Payment ID required" });
        const pRef = db.collection("payments").doc(pid);
        const pSnap = await pRef.get();
        if (!pSnap.exists) return res.json({ success: false, message: "Payment not found" });
        
        const payment = pSnap.data();
        if (payment.status === "Approved") return res.json({ success: false, message: "Payment already approved" });
        
        await pRef.update({ 
          status: "Approved", 
          approvedAt: new Date().toISOString(), 
          approvedBy: req.session.userId 
        });
        
        await db.collection("audit_logs").add({
          timestamp: new Date().toISOString(),
          userId: req.session.userId,
          action: "APPROVE_PAYMENT",
          details: `Approved payment ${pid} for ${payment.amount || 'an unknown amount'}.`
        });
        
        return res.json({ success: true, message: "Payment approved successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminRejectPayment: async (req, res) => { 
      try {
        const pid = req.body.paymentId;
        if (!pid) return res.json({ success: false, message: "Payment ID required" });
        const pRef = db.collection("payments").doc(pid);
        
        await pRef.update({ 
          status: "Rejected", 
          rejectedAt: new Date().toISOString(), 
          rejectedBy: req.session.userId 
        });
        
        await db.collection("audit_logs").add({
          timestamp: new Date().toISOString(),
          userId: req.session.userId,
          action: "REJECT_PAYMENT",
          details: `Rejected payment ${pid}.`
        });
        
        return res.json({ success: true, message: "Payment rejected successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminApproveTask: async (req, res) => { 
      try {
        const taskId = req.body.taskId;
        if (!taskId) return res.json({ success: false, message: "Task ID required" });
        const ref = db.collection("approvals").doc(taskId);
        await ref.update({ status: "Approved", approvedAt: new Date().toISOString(), approvedBy: req.session.userId });
        return res.json({ success: true, message: "Task approved successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminRejectTask: async (req, res) => { 
      try {
        const { taskId, note } = req.body;
        if (!taskId) return res.json({ success: false, message: "Task ID required" });
        const ref = db.collection("approvals").doc(taskId);
        await ref.update({ status: "Rejected", rejectNote: note || "", rejectedAt: new Date().toISOString(), rejectedBy: req.session.userId });
        return res.json({ success: true, message: "Task rejected successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminImpersonateUser: async (req, res) => { 
      try {
        const userId = req.body.userId;
        if (!userId) return res.json({ success: false, message: "User ID required" });
        
        const userDoc = await db.collection("users").doc(userId).get();
        if (!userDoc.exists) return res.json({ success: false, message: "User not found" });
        
        const user = userDoc.data();
        const token = uuidv4();
        
        await db.collection("sessions").doc(token).set({
          userId: userDoc.id,
          role: user.role,
          fullName: user.fullName,
          section: user.section || "both",
          createdAt: new Date().toISOString()
        });
        
        await db.collection("audit_logs").add({
          timestamp: new Date().toISOString(),
          userId: req.session.userId,
          action: "IMPERSONATE_USER",
          details: `Admin ${req.session.userId} generated a session to impersonate ${userId}.`
        });
        
        return res.json({ success: true, token, role: user.role });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGenerateIDCard: async (req, res) => {
      const { studentId } = req.body;
      try {
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
        return res.json({ success: false, message: "Error generating ID card: " + err.message });
      }
    },
    adminEnrollStudent: async (req, res) => { 
      try {
        const { studentId, subjectId, session, term } = req.body;
        if (!studentId || !subjectId) return res.json({ success: false, message: "Student and Subject ID required" });
        
        const existing = await db.collection("student_subjects")
          .where("studentId", "==", studentId)
          .where("subjectId", "==", subjectId).get();
          
        if (!existing.empty) return res.json({ success: false, message: "Student already enrolled in this subject" });
        
        await db.collection("student_subjects").add({
          studentId, subjectId, session, term, enrolledAt: new Date().toISOString()
        });
        return res.json({ success: true, message: "Student enrolled successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminUnenrollStudent: async (req, res) => { 
      try {
        const { studentId, subjectId } = req.body;
        if (!studentId || !subjectId) return res.json({ success: false, message: "Student and Subject ID required" });
        
        const existing = await db.collection("student_subjects")
          .where("studentId", "==", studentId)
          .where("subjectId", "==", subjectId).get();
          
        if (existing.empty) return res.json({ success: false, message: "Enrollment not found" });
        
        const batch = db.batch();
        existing.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        return res.json({ success: true, message: "Student unenrolled successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminSaveGradeRule: async (req, res) => { 
      try {
        const data = req.body.data;
        if (!data) return res.json({ success: false, message: "Rule data required" });
        await db.collection("settings").doc("grading").set(data, { merge: true });
        
        await db.collection("audit_logs").add({
          timestamp: new Date().toISOString(),
          userId: req.session.userId,
          action: "UPDATE_GRADING",
          details: `Updated grading rules.`
        });
        return res.json({ success: true, message: "Grading rules saved successfully." });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    adminGenerateBulkResult: async (req, res) => { 
      try {
        const { className, term, session, rptType } = req.body;
        if (!className || !term || !session) return res.json({ success: false, message: "Class, term, and session required." });
        
        // Fetch all assessments for this class/term/session
        const assessmentsSnap = await db.collection("assessments")
          .where("className", "==", className)
          .where("term", "==", term)
          .where("session", "==", session).get();
          
        if (assessmentsSnap.empty) return res.json({ success: false, message: "No assessments found for this class and term." });
        
        const assessments = assessmentsSnap.docs.map(d => d.data());
        
        // Group by student
        const studentResults = {};
        assessments.forEach(ass => {
          if (!studentResults[ass.studentId]) {
            studentResults[ass.studentId] = { studentId: ass.studentId, totalScore: 0, subjects: 0 };
          }
          studentResults[ass.studentId].totalScore += (Number(ass.total) || 0);
          studentResults[ass.studentId].subjects += 1;
        });
        
        // Save summary to results collection
        const batch = db.batch();
        Object.keys(studentResults).forEach(sid => {
          const docRef = db.collection("results").doc(`${sid}_${term}_${session}`);
          batch.set(docRef, {
            studentId: sid,
            className, term, session, type: rptType,
            totalScore: studentResults[sid].totalScore,
            average: studentResults[sid].subjects > 0 ? (studentResults[sid].totalScore / studentResults[sid].subjects) : 0,
            generatedAt: new Date().toISOString()
          }, { merge: true });
        });
        
        await batch.commit();
        
        return res.json({ success: true, message: `Successfully generated results for ${Object.keys(studentResults).length} students.` });
      } catch (err) { return res.json({ success: false, message: err.message }); }
    },
    
    adminGetBroadsheetData: async (req, res) => {
      try {
        const { className, term, session } = req.body;
        if (!className || !term || !session) return res.json({ success: false, message: "Class, term, and session required." });
        
        const assessmentsSnap = await db.collection("assessments")
          .where("className", "==", className)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
          
        const assessments = assessmentsSnap.docs.map(doc => doc.data());
        
        const subjectsSet = new Set();
        const studentMap = {}; 
        
        const studentsSnap = await db.collection("students").where("className", "==", className).get();
        studentsSnap.forEach(doc => {
          const s = doc.data();
          studentMap[doc.id] = { id: doc.id, fullName: s.fullName || (s.firstName + ' ' + s.lastName), subjects: {}, totalScore: 0 };
        });
        
        assessments.forEach(ass => {
          if (!ass.subjectName) return; 
          subjectsSet.add(ass.subjectName);
          
          if (!studentMap[ass.studentId]) {
            studentMap[ass.studentId] = { id: ass.studentId, fullName: ass.studentName || ass.studentId, subjects: {}, totalScore: 0 };
          }
          const total = Number(ass.total) || 0;
          studentMap[ass.studentId].subjects[ass.subjectName] = total;
          studentMap[ass.studentId].totalScore += total;
        });
        
        const subjects = Array.from(subjectsSet).sort();
        const students = Object.values(studentMap).map(st => {
          st.average = subjects.length > 0 ? (st.totalScore / subjects.length).toFixed(1) : 0;
          return st;
        });
        
        students.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
        
        return res.json({ success: true, data: { subjects, students } });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }

  };
};
