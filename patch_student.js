const fs = require('fs');
const path = require('path');
const p = path.join('c:\\Users\\OASISFAITH\\Desktop\\Portal Projects\\Myschool Portal Cloud Version', 'functions', 'actions', 'student.js');
let c = fs.readFileSync(p, 'utf8');

const startQuizReplacement = `
        const existingSnap = await db.collection("cbt_attempts")
          .where("quizId", "==", quizId)
          .where("studentId", "==", userId)
          .limit(1).get();
          
        let attemptId = null;
        let savedAnswers = {};
        let savedSecs = null;

        if (!existingSnap.empty) {
          const att = existingSnap.docs[0].data();
          if (att.status === "completed") {
            return res.json({ success: false, alreadyAttempted: true, message: "You have already attempted this quiz.", score: att.score, total: att.total, percentage: att.percentage });
          } else {
            attemptId = existingSnap.docs[0].id;
            if (att.answers && Array.isArray(att.answers)) {
              att.answers.forEach(a => {
                if (a.selectedOption) savedAnswers[a.questionId] = a.selectedOption;
              });
            }
            if (att.remainingSeconds !== undefined) savedSecs = att.remainingSeconds;
          }
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
        
        // Only shuffle if it's a new attempt, to avoid confusing them if they resume? 
        // Actually, the answer is mapped by ID and letter, so shuffle is perfectly safe.
        if (quiz.shuffleQuestions !== false) {
          questions.sort(() => Math.random() - 0.5);
        }

        if (!attemptId) {
          const attemptRef = db.collection("cbt_attempts").doc();
          await attemptRef.set({
            quizId, studentId: userId, studentName: fullName, className,
            startedAt: new Date().toISOString(), status: "in_progress"
          });
          attemptId = attemptRef.id;
        }

        return res.json({
          success: true,
          attemptId,
          savedAnswers,
          savedSecs,
          quiz: {
            title: quiz.title,
            durationMinutes: quiz.durationMinutes,
            shuffleOptions: quiz.shuffleOptions !== false
          },
          questions
        });
`;

c = c.replace(/const existingSnap = await db\.collection\("cbt_attempts"\).*?shuffleOptions !== false  \/\/ default true\r?\n\s*},\r?\n\s*questions\r?\n\s*}\);/s, startQuizReplacement);

const saveProgressApi = `
    studentSaveQuizProgress: async (req, res) => {
      if (!req.session || req.session.role !== "student") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }
      const { attemptId, answers, remainingSeconds } = req.body;
      if (!attemptId) return res.json({ success: false, message: "Attempt ID required." });
      try {
        const attemptRef = db.collection("cbt_attempts").doc(attemptId);
        const attemptDoc = await attemptRef.get();
        if (!attemptDoc.exists) return res.json({ success: false, message: "Attempt not found." });
        if (attemptDoc.data().status === "completed") {
          return res.json({ success: false, message: "Quiz already completed." });
        }
        await attemptRef.update({
          answers: answers || [],
          remainingSeconds: remainingSeconds || 0,
          lastSavedAt: new Date().toISOString()
        });
        return res.json({ success: true, message: "Progress saved." });
      } catch (err) {
        return res.json({ success: false, message: err.message });
      }
    },

    studentSubmitQuiz: async (req, res) => {
`;

c = c.replace(/studentSubmitQuiz:\s*async\s*\(req,\s*res\)\s*=>\s*\{/, saveProgressApi);

fs.writeFileSync(p, c);
console.log('Updated student.js');
