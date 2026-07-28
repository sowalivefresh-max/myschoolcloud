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
        const [teachersSnap, parentsSnap] = await Promise.all([
          db.collection("users").where("role", "in", ["teacher", "primary_teacher"]).count().get(),
          db.collection("users").where("role", "==", "parent").count().get()
        ]);

        const totalTeachers = teachersSnap.data().count;
        const totalParents = parentsSnap.data().count;
        const totalStaff = totalUsers - totalParents; // Rough calculation

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

    adminUpdateUser: async (req, res) => {
      const { userId, updates } = req.body;
      if (!userId || !updates) return res.json({ success: false, message: "User ID and updates required." });
      
      try {
        // If password is being updated, we need to hash it
        if (updates.password) {
          const crypto = require("crypto");
          function hashPassword(password, salt) {
             return crypto.createHmac("sha256", "super-secret-key").update(password + salt).digest("hex");
          }
          const userDoc = await db.collection("users").doc(userId).get();
          if (userDoc.exists) {
            const user = userDoc.data();
            updates.passwordHash = hashPassword(updates.password, user.salt || "");
            delete updates.password;
          }
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

        let generated = 0;
        let skipped = 0;
        const batch = db.batch(); // Note: Firestore batch is limited to 500 operations, this might need chunking in production

        for (let student of students) {
          const sid = student.id;
          const className = student.className || "";
          
          // Check existing bill
          const existingBillSnap = await db.collection("bills")
            .where("studentId", "==", sid)
            .where("term", "==", term)
            .where("session", "==", session)
            .get();
            
          if (!existingBillSnap.empty) {
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
          batch.set(newBillRef, {
            id: newBillRef.id, studentId: sid, studentName: student.fullName, className: className,
            term: term, session: session, totalBilled: total, totalPaid: appliedCredit,
            balance: finalBalance, status: billStatus, createdAt: new Date().toISOString()
          });

          // Trigger notification to the parent
          if (student.parentId && notificationsActions) {
            notificationsActions.createNotification(
              student.parentId,
              "New Bill Assigned",
              `A new fee bill of ₦${total.toLocaleString()} for ${student.fullName || 'your child'} (${term}, ${session}) has been generated.`,
              "BILL"
            );
          }

          generated++;
        }
        
        if (generated > 0) {
          await batch.commit();
          await db.collection("audit_logs").add({
            timestamp: new Date().toISOString(),
            userId: recordedByUserId,
            action: "GENERATE_BILLS",
            details: `${term} ${session}: ${generated} bills generated.`
          });
        }
        
        return res.json({ success: true, message: `${generated} bill(s) generated. ${skipped} skipped.` });
      } catch (err) {
        return res.json({ success: false, message: "Error generating bills: " + err.message });
      }
    }
  };
};
