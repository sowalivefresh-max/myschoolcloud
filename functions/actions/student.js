const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

module.exports = function(db) {
  return {

    // === STUDENT AUTH ===

    studentLogin: async (req, res) => {
      const { admissionNumber, password } = req.body;
      if (!admissionNumber || !password) {
        return res.json({ success: false, message: "Admission number and password are required." });
      }
      try {
        const snap = await db.collection("students")
          .where("admissionNumber", "==", admissionNumber.trim())
          .where("status", "==", "active")
          .limit(1).get();

        if (snap.empty) {
          return res.json({ success: false, message: "Invalid admission number or password." });
        }

        const doc = snap.docs[0];
        const student = doc.data();

        if (!student.portalEnabled) {
          return res.json({ success: false, message: "Your portal account is not yet activated. Please contact admin." });
        }

        const hash = student.portalPasswordHash;
        if (!hash) {
          return res.json({ success: false, message: "No portal password set. Please contact admin." });
        }

        const isMatch = await bcrypt.compare(String(password), hash);
        if (!isMatch) {
          return res.json({ success: false, message: "Invalid admission number or password." });
        }

        const token = uuidv4();
        await db.collection("sessions").doc(token).set({
          userId: doc.id,
          role: "student",
          fullName: student.fullName,
          studentId: doc.id,
          admissionNumber: student.admissionNumber,
          className: student.className || "",
          section: student.section || "primary",
          campusId: student.campusId || null,
          createdAt: new Date().toISOString()
        });

        return res.json({
          success: true,
          token,
          role: "student",
          mustChangePassword: !!student.mustChangePassword,
          userName: student.fullName,
          userId: doc.id,
          admissionNumber: student.admissionNumber
        });
      } catch (err) {
        return res.json({ success: false, message: "Login error: " + err.message });
      }
    },

    studentChangePassword: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      const { newPassword, currentPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.json({ success: false, message: "New password must be at least 6 characters." });
      }
      try {
        const studentRef = db.collection("students").doc(req.session.userId);
        const studentDoc = await studentRef.get();
        const student = studentDoc.data();

        if (!student.mustChangePassword) {
          if (!currentPassword) return res.json({ success: false, message: "Current password is required." });
          const match = await bcrypt.compare(String(currentPassword), student.portalPasswordHash);
          if (!match) return res.json({ success: false, message: "Incorrect current password." });
        }

        const newHash = await bcrypt.hash(String(newPassword), 10);
        await studentRef.update({ portalPasswordHash: newHash, mustChangePassword: false });

        const sessSnap = await db.collection("sessions").where("userId", "==", req.session.userId).get();
        const batch = db.batch();
        sessSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        return res.json({ success: true, message: "Password changed successfully. Please log in again." });
      } catch (err) {
        return res.json({ success: false, message: "Error changing password: " + err.message });
      }
    },

    studentGetMyInfo: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      try {
        const doc = await db.collection("students").doc(req.session.userId).get();
        if (!doc.exists) return res.json({ success: false, message: "Student not found." });
        const data = doc.data();
        delete data.portalPasswordHash;
        return res.json({ success: true, data: { id: doc.id, ...data } });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentResetPassword: async (req, res) => {
      const { studentId } = req.body;
      if (!studentId) return res.json({ success: false, message: "Student ID required." });
      try {
        const doc = await db.collection("students").doc(studentId).get();
        if (!doc.exists) return res.json({ success: false, message: "Student not found." });
        const student = doc.data();

        let defaultPassword = "Welcome@1";
        if (student.dateOfBirth) {
          const dob = student.dateOfBirth.replace(/[-/]/g, "");
          if (dob.length === 8) {
            if (parseInt(dob.substring(0, 4)) > 1900) {
              defaultPassword = dob.substring(6, 8) + dob.substring(4, 6) + dob.substring(0, 4);
            } else {
              defaultPassword = dob;
            }
          }
        }

        const hash = await bcrypt.hash(defaultPassword, 10);
        await db.collection("students").doc(studentId).update({
          portalPasswordHash: hash,
          mustChangePassword: true,
          portalEnabled: true
        });

        return res.json({ success: true, message: "Password reset successfully. Student must change password on next login." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentGetAssignments: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      try {
        const { className } = req.session;
        const settingsDoc = await db.collection("settings").doc("global").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const term = settings.current_term || "";
        const session = settings.current_session || "";

        const snap = await db.collection("assignments")
          .where("term", "==", term)
          .where("session", "==", session).get();

        const results = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (!d.className || d.className === className || d.className === "All") {
            results.push({ id: doc.id, ...d });
          }
        });
        results.sort((a, b) => (b.createdAt || "") > (a.createdAt || "") ? 1 : -1);
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentGetNotes: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      try {
        const { className } = req.session;
        const settingsDoc = await db.collection("settings").doc("global").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const term = settings.current_term || "";
        const session = settings.current_session || "";

        const snap = await db.collection("lesson_notes")
          .where("term", "==", term)
          .where("session", "==", session).get();

        const now = Date.now();
        const results = [];
        const deletePromises = [];
        snap.forEach(doc => {
          const d = doc.data();
          const created = d.createdAt ? new Date(d.createdAt).getTime() : 0;
          if (now - created > 7 * 24 * 60 * 60 * 1000) {
            deletePromises.push(doc.ref.delete());
            return;
          }
          if (!d.className || d.className === className || d.className === "All") {
            const { fileData, ...meta } = d;
            results.push({ id: doc.id, ...meta });
          }
        });
        await Promise.all(deletePromises);
        results.sort((a, b) => (b.createdAt || "") > (a.createdAt || "") ? 1 : -1);
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentGetNoteFile: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      const { noteId } = req.body;
      if (!noteId) return res.json({ success: false, message: "Note ID required." });
      try {
        const doc = await db.collection("lesson_notes").doc(noteId).get();
        if (!doc.exists) return res.json({ success: false, message: "Note not found." });
        const d = doc.data();
        const created = d.createdAt ? new Date(d.createdAt).getTime() : 0;
        if (Date.now() - created > 7 * 24 * 60 * 60 * 1000) {
          return res.json({ success: false, message: "This note has expired and is no longer available." });
        }
        return res.json({ success: true, fileData: d.fileData, fileName: d.fileName, mimeType: d.mimeType || "application/pdf" });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentGetQuizzes: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      try {
        const { className, userId } = req.session;
        const settingsDoc = await db.collection("settings").doc("global").get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        const term = settings.current_term || "";
        const session = settings.current_session || "";

        const snap = await db.collection("cbt_quizzes")
          .where("term", "==", term)
          .where("session", "==", session).get();

        const attSnap = await db.collection("cbt_attempts")
          .where("studentId", "==", userId).get();
        const attemptedMap = {};
        attSnap.forEach(d => {
          const data = d.data();
          if (data.status === "completed") attemptedMap[data.quizId] = { score: data.score, total: data.total, percentage: data.percentage };
        });

        const results = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (!d.className || d.className === className || d.className === "All") {
            results.push({ id: doc.id, ...d, attemptResult: attemptedMap[doc.id] || null });
          }
        });
        return res.json({ success: true, data: results });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentStartQuiz: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      const { quizId } = req.body;
      if (!quizId) return res.json({ success: false, message: "Quiz ID required." });
      try {
        const { userId, fullName, className } = req.session;

        const existingSnap = await db.collection("cbt_attempts")
          .where("quizId", "==", quizId)
          .where("studentId", "==", userId)
          .where("status", "==", "completed")
          .limit(1).get();
        if (!existingSnap.empty) {
          const att = existingSnap.docs[0].data();
          return res.json({ success: false, alreadyAttempted: true, message: "You have already attempted this quiz.", score: att.score, total: att.total, percentage: att.percentage });
        }

        const quizDoc = await db.collection("cbt_quizzes").doc(quizId).get();
        if (!quizDoc.exists) return res.json({ success: false, message: "Quiz not found." });
        const quiz = quizDoc.data();

        const qSnap = await db.collection("cbt_questions").where("quizId", "==", quizId).get();
        const questions = [];
        qSnap.forEach(doc => {
          const q = doc.data();
          questions.push({ id: doc.id, question: q.question, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD });
        });
        // Respect per-quiz shuffle setting (default: true for existing quizzes)
        if (quiz.shuffleQuestions !== false) {
          questions.sort(() => Math.random() - 0.5);
        }

        const attemptRef = db.collection("cbt_attempts").doc();
        await attemptRef.set({
          quizId, studentId: userId, studentName: fullName, className,
          startedAt: new Date().toISOString(), status: "in_progress"
        });

        return res.json({
          success: true,
          attemptId: attemptRef.id,
          quiz: {
            title: quiz.title,
            durationMinutes: quiz.durationMinutes,
            shuffleOptions: quiz.shuffleOptions !== false  // default true
          },
          questions
        });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentSubmitQuiz: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      const { attemptId, answers } = req.body;
      if (!attemptId || !answers) return res.json({ success: false, message: "Attempt ID and answers required." });
      try {
        const attemptRef = db.collection("cbt_attempts").doc(attemptId);
        const attemptDoc = await attemptRef.get();
        if (!attemptDoc.exists) return res.json({ success: false, message: "Attempt not found." });
        if (attemptDoc.data().status === "completed") {
          return res.json({ success: false, message: "Quiz already submitted." });
        }

        const { quizId } = attemptDoc.data();
        const qSnap = await db.collection("cbt_questions").where("quizId", "==", quizId).get();
        const correctMap = {};
        qSnap.forEach(doc => { correctMap[doc.id] = doc.data().correctAnswer; });

        let score = 0;
        const total = Object.keys(correctMap).length;
        const gradedAnswers = (answers || []).map(a => {
          const isCorrect = a.selectedOption && correctMap[a.questionId] &&
            a.selectedOption.toUpperCase() === correctMap[a.questionId].toUpperCase();
          if (isCorrect) score++;
          return { questionId: a.questionId, selected: a.selectedOption, correct: correctMap[a.questionId], isCorrect };
        });

        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

        await attemptRef.update({
          status: "completed",
          submittedAt: new Date().toISOString(),
          score, total, percentage, answers: gradedAnswers
        });

        return res.json({ success: true, score, total, percentage, message: `Quiz submitted! You scored ${score}/${total} (${percentage}%)` });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    }
  };
};
