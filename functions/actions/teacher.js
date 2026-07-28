module.exports = function(db) {
  return {
    teacherGetMySubjects: async (req, res) => {
      // Session attached by middleware
      const session = req.session;
      const role = session.role;
      const userId = session.userId;
      
      try {
        if (role === 'primary_teacher') {
          // Fetch the user to get their assigned class
          const userDoc = await db.collection("users").doc(userId).get();
          const myClass = userDoc.data().classAssigned || "";
          
          const subjectsSnap = await db.collection("subjects").get();
          const subjects = [];
          
          subjectsSnap.forEach(doc => {
            let sub = doc.data();
            sub.id = doc.id;
            
            if (String(sub.assignedTeacherId) === String(userId)) {
              subjects.push(sub);
            } else if (sub.section === 'primary') {
              if (myClass && sub.className && String(sub.className) === String(myClass)) {
                subjects.push(sub);
              } else if (!sub.className || String(sub.className).trim() === '') {
                subjects.push(sub);
              }
            }
          });
          return res.json({ success: true, data: subjects });
        } else {
          // Standard high school teacher, just get explicitly assigned subjects
          const subjectsSnap = await db.collection("subjects").where("assignedTeacherId", "==", String(userId)).get();
          const subjects = [];
          subjectsSnap.forEach(doc => {
            let sub = doc.data();
            sub.id = doc.id;
            subjects.push(sub);
          });
          return res.json({ success: true, data: subjects });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error fetching subjects: " + err.message });
      }
    },

    teacherGetClassStudents: async (req, res) => {
      const className = req.body.className;
      if (!className) return res.json({ success: false, message: "Class name required." });
      
      try {
        const studentsSnap = await db.collection("students")
          .where("className", "==", className)
          .where("status", "==", "active")
          .get();
          
        const students = [];
        studentsSnap.forEach(doc => {
          let st = doc.data();
          st.id = doc.id;
          students.push(st);
        });
        
        return res.json({ success: true, data: students });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching students: " + err.message });
      }
    },

    teacherGetScores: async (req, res) => {
      const filters = req.body.filters || {};
      const session = req.session;
      
      if (!filters.subjectId) {
        filters.teacherId = session.userId;
      }
      
      try {
        let query = db.collection("assessments");
        
        if (filters.subjectId) query = query.where("subjectId", "==", filters.subjectId);
        if (filters.teacherId) query = query.where("teacherId", "==", filters.teacherId);
        if (filters.className) query = query.where("className", "==", filters.className);
        if (filters.term) query = query.where("term", "==", filters.term);
        if (filters.session) query = query.where("session", "==", filters.session);
        
        const scoresSnap = await query.get();
        const scores = [];
        scoresSnap.forEach(doc => {
          let s = doc.data();
          s.id = doc.id;
          scores.push(s);
        });
        
        return res.json({ success: true, data: scores });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching scores: " + err.message });
      }
    },
    
    teacherGetLessonPlans: async (req, res) => {
      const session = req.session;
      try {
        const plansSnap = await db.collection("lessonPlans")
          .where("teacherId", "==", session.userId)
          .orderBy("createdAt", "desc")
          .get();
          
        const plans = [];
        plansSnap.forEach(doc => {
          let p = doc.data();
          p.id = doc.id;
          plans.push(p);
        });
        
        return res.json({ success: true, data: plans });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching lesson plans: " + err.message });
      }
    },

    teacherSaveScore: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.studentId || !data.subjectId) {
        return res.json({ success: false, message: "Student ID and Subject ID required." });
      }
      
      try {
        if (data.id) {
          await db.collection("assessments").doc(data.id).update(data);
          return res.json({ success: true, message: "Score updated successfully." });
        } else {
          // Verify existing score
          const existingSnap = await db.collection("assessments")
            .where("studentId", "==", data.studentId)
            .where("subjectId", "==", data.subjectId)
            .where("term", "==", data.term)
            .where("session", "==", data.session)
            .get();
            
          if (!existingSnap.empty) {
            await db.collection("assessments").doc(existingSnap.docs[0].id).update(data);
            return res.json({ success: true, message: "Score updated successfully." });
          } else {
            const newRef = db.collection("assessments").doc();
            data.id = newRef.id;
            await newRef.set(data);
            return res.json({ success: true, message: "Score saved successfully." });
          }
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving score: " + err.message });
      }
    },

    teacherBulkSaveScores: async (req, res) => {
      const scores = req.body.data;
      if (!scores || !Array.isArray(scores) || scores.length === 0) {
        return res.json({ success: false, message: "No score data provided." });
      }

      try {
        const batch = db.batch();
        let count = 0;
        
        for (let data of scores) {
          if (!data.studentId || !data.subjectId) continue;
          
          if (data.id) {
            batch.update(db.collection("assessments").doc(data.id), data);
          } else {
            const existingSnap = await db.collection("assessments")
              .where("studentId", "==", data.studentId)
              .where("subjectId", "==", data.subjectId)
              .where("term", "==", data.term)
              .where("session", "==", data.session)
              .get();
              
            if (!existingSnap.empty) {
              batch.update(db.collection("assessments").doc(existingSnap.docs[0].id), data);
            } else {
              const newRef = db.collection("assessments").doc();
              data.id = newRef.id;
              batch.set(newRef, data);
            }
          }
          count++;
        }
        
        if (count > 0) await batch.commit();
        return res.json({ success: true, message: `${count} scores saved successfully.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving bulk scores: " + err.message });
      }
    },

    teacherSaveLessonPlan: async (req, res) => {
      const data = req.body.data;
      const session = req.session;
      
      if (!data || !data.title) {
        return res.json({ success: false, message: "Plan title is required." });
      }

      try {
        if (data.id) {
          await db.collection("lessonPlans").doc(data.id).update({
            ...data,
            updatedAt: new Date().toISOString()
          });
          return res.json({ success: true, message: "Lesson plan updated." });
        } else {
          const newRef = db.collection("lessonPlans").doc();
          await newRef.set({
            ...data,
            id: newRef.id,
            teacherId: session.userId,
            teacherName: session.fullName,
            createdAt: new Date().toISOString(),
            status: "Pending" // requires admin/principal approval usually
          });
          return res.json({ success: true, message: "Lesson plan submitted." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving lesson plan: " + err.message });
      }
    },

    teacherGetAttendance: async (req, res) => {
      const { className, date } = req.body;
      if (!className || !date) return res.json({ success: false, message: "Class and date required." });
      
      try {
        const attendanceSnap = await db.collection("attendance")
          .where("className", "==", className)
          .where("date", "==", date)
          .get();
          
        const records = [];
        attendanceSnap.forEach(doc => {
          let rec = doc.data();
          rec.id = doc.id;
          records.push(rec);
        });
        
        return res.json({ success: true, data: records });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching attendance: " + err.message });
      }
    },

    teacherSaveAttendance: async (req, res) => {
      const records = req.body.data;
      if (!records || !Array.isArray(records)) {
        return res.json({ success: false, message: "Invalid attendance data." });
      }

      try {
        const batch = db.batch();
        let count = 0;
        
        for (let record of records) {
          if (!record.studentId || !record.date) continue;
          
          if (record.id) {
            batch.update(db.collection("attendance").doc(record.id), record);
          } else {
            const existingSnap = await db.collection("attendance")
              .where("studentId", "==", record.studentId)
              .where("date", "==", record.date)
              .get();
              
            if (!existingSnap.empty) {
              batch.update(db.collection("attendance").doc(existingSnap.docs[0].id), record);
            } else {
              const newRef = db.collection("attendance").doc();
              record.id = newRef.id;
              batch.set(newRef, record);
            }
          }
          count++;
        }
        
        if (count > 0) await batch.commit();
        return res.json({ success: true, message: `Attendance saved for ${count} students.` });
      } catch (err) {
        return res.json({ success: false, message: "Error saving attendance: " + err.message });
      }
    },

    teacherGetPsychomotor: async (req, res) => {
      const { studentId, term, session } = req.body;
      if (!studentId || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      
      try {
        const snap = await db.collection("psychomotorRecords")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
          
        if (snap.empty) return res.json({ success: true, data: null });
        let data = snap.docs[0].data();
        data.id = snap.docs[0].id;
        return res.json({ success: true, data: data });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching psychomotor: " + err.message });
      }
    },

    teacherSavePsychomotor: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.studentId || !data.term || !data.session) {
        return res.json({ success: false, message: "Missing required data." });
      }

      try {
        const snap = await db.collection("psychomotorRecords")
          .where("studentId", "==", data.studentId)
          .where("term", "==", data.term)
          .where("session", "==", data.session)
          .get();

        if (!snap.empty) {
          await db.collection("psychomotorRecords").doc(snap.docs[0].id).update(data);
          return res.json({ success: true, message: "Psychomotor record updated." });
        } else {
          const newRef = db.collection("psychomotorRecords").doc();
          data.id = newRef.id;
          await newRef.set(data);
          return res.json({ success: true, message: "Psychomotor record saved." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving psychomotor: " + err.message });
      }
    },

    teacherGetAffective: async (req, res) => {
      const { studentId, term, session } = req.body;
      if (!studentId || !term || !session) return res.json({ success: false, message: "Missing parameters." });
      
      try {
        const snap = await db.collection("affectiveRecords")
          .where("studentId", "==", studentId)
          .where("term", "==", term)
          .where("session", "==", session)
          .get();
          
        if (snap.empty) return res.json({ success: true, data: null });
        let data = snap.docs[0].data();
        data.id = snap.docs[0].id;
        return res.json({ success: true, data: data });
      } catch (err) {
        return res.json({ success: false, message: "Error fetching affective record: " + err.message });
      }
    },

    teacherSaveAffective: async (req, res) => {
      const data = req.body.data;
      if (!data || !data.studentId || !data.term || !data.session) {
        return res.json({ success: false, message: "Missing required data." });
      }

      try {
        const snap = await db.collection("affectiveRecords")
          .where("studentId", "==", data.studentId)
          .where("term", "==", data.term)
          .where("session", "==", data.session)
          .get();

        if (!snap.empty) {
          await db.collection("affectiveRecords").doc(snap.docs[0].id).update(data);
          return res.json({ success: true, message: "Affective record updated." });
        } else {
          const newRef = db.collection("affectiveRecords").doc();
          data.id = newRef.id;
          await newRef.set(data);
          return res.json({ success: true, message: "Affective record saved." });
        }
      } catch (err) {
        return res.json({ success: false, message: "Error saving affective record: " + err.message });
      }
    }
  };
};
