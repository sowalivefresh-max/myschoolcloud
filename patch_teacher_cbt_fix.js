const fs = require('fs');
const path = require('path');
const p = path.join('c:\\Users\\OASISFAITH\\Desktop\\Portal Projects\\Myschool Portal Cloud Version', 'TeacherDashboard.html');
let c = fs.readFileSync(p, 'utf8');

const newManage = `
    function manageQuizQuestions(quizId) {
      editQuizId = quizId;
      document.getElementById('questionEditorList').innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i></div>';
      openModal('questionsModal');
      callServer('teacherGetQuizQuestions', [AA.token, quizId], function(res) {
        if (res && res.success === false) {
          document.getElementById('questionEditorList').innerHTML = '<div class="aa-empty-state">Error loading questions. ' + (res.message || '') + '</div>';
        } else {
          currentQuizQuestions = Array.isArray(res) ? res : (res && res.data ? res.data : []);
          if (currentQuizQuestions.length === 0) currentQuizQuestions.push(createEmptyQuestion());
          renderQuestionEditor();
        }
      });
    }
`;

c = c.replace(/function manageQuizQuestions\(quizId\) \{[\s\S]*?\}\s*function createEmptyQuestion/, newManage.trim() + '\n    function createEmptyQuestion');

const newParse = `
    function parseBulkQuestions() {
      var text = document.getElementById('bulkQText').value;
      if (!text.trim()) return;

      var allLines = text.split(/\\r?\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      var blocks = [];
      var currentBlock = [];
      
      for (var i = 0; i < allLines.length; i++) {
        var l = allLines[i];
        currentBlock.push(l);
        if (/^(answer|ans)[:\\s]/i.test(l)) {
          blocks.push(currentBlock.slice()); // clone array
          currentBlock = [];
        } else if (/^Q:/i.test(l) && currentBlock.length > 1) {
          // Found a Q: but we already had lines in currentBlock?
          // It means the previous question didn't have an answer line.
          var previousLine = currentBlock.pop(); // The 'Q:' line
          blocks.push(currentBlock.slice());
          currentBlock = [previousLine];
        }
      }
      if (currentBlock.length > 0) blocks.push(currentBlock);

      var added = 0;

      blocks.forEach(function(lines) {
        if (lines.length < 2) return;

        var qObj = createEmptyQuestion();

        // Detect format type
        var hasQPrefix = lines.some(function(l) { return /^Q:/i.test(l); });
        var hasAnsPrefix = lines.some(function(l) { return /^ANS:/i.test(l); });

        if (hasQPrefix || hasAnsPrefix) {
          // ---- Format 1: Q: / A: / B: / C: / D: / ANS: ----
          lines.forEach(function(l) {
            if (/^Q:/i.test(l))         qObj.question     = l.replace(/^Q:\\s*/i, '').trim();
            else if (/^A:/i.test(l))    qObj.optionA      = l.replace(/^A:\\s*/i, '').trim();
            else if (/^B:/i.test(l))    qObj.optionB      = l.replace(/^B:\\s*/i, '').trim();
            else if (/^C:/i.test(l))    qObj.optionC      = l.replace(/^C:\\s*/i, '').trim();
            else if (/^D:/i.test(l))    qObj.optionD      = l.replace(/^D:\\s*/i, '').trim();
            else if (/^ANS:/i.test(l))  qObj.correctAnswer = l.replace(/^ANS:\\s*/i, '').trim().toUpperCase().charAt(0);
          });
        } else {
          // ---- Format 2/3: First line is the question, options follow ----
          // First line is question (strip leading number/dot if present e.g. "1. What...")
          qObj.question = lines[0].replace(/^\\d+[.)\\s]+/, '').trim();

          var options = [];
          var answerLine = null;

          for (var i = 1; i < lines.length; i++) {
            var l = lines[i];
            // Detect answer line: "Answer: A" or "Answer: 1" or "Ans: B" etc.
            if (/^(answer|ans)[:\\s]/i.test(l)) {
              answerLine = l.replace(/^(answer|ans)[:\\s]*/i, '').trim().toUpperCase();
              continue;
            }
            // Strip option prefix: A) A. A: 1) 1. 1:
            var cleaned = l.replace(/^([A-Da-d]|[1-4])[.):\\s]+/, '').trim();
            if (cleaned) options.push(cleaned);
          }

          if (options[0]) qObj.optionA = options[0];
          if (options[1]) qObj.optionB = options[1];
          if (options[2]) qObj.optionC = options[2];
          if (options[3]) qObj.optionD = options[3];

          // Map answer: if answer is a number (1-4), convert to letter
          if (answerLine) {
            var numMap = {'1':'A','2':'B','3':'C','4':'D'};
            if (numMap[answerLine]) {
              qObj.correctAnswer = numMap[answerLine];
            } else {
              qObj.correctAnswer = answerLine.charAt(0).toUpperCase();
            }
          }
        }

        if (qObj.question && qObj.optionA) { currentQuizQuestions.push(qObj); added++; }
      });
`;

c = c.replace(/function parseBulkQuestions\(\) \{[\s\S]*?if \(qObj\.question && qObj\.optionA\) \{ currentQuizQuestions\.push\(qObj\); added\+\+; \}\r?\n\s*\}\);\r?\n/, newParse.trim() + '\n\n');

fs.writeFileSync(p, c);
console.log('Updated TeacherDashboard.html');
