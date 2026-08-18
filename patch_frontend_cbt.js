const fs = require('fs');
const path = require('path');
const p = path.join('c:\\Users\\OASISFAITH\\Desktop\\Portal Projects\\Myschool Portal Cloud Version', 'StudentDashboard.html');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/_cbtQuestions=questions;_cbtAnswers={};_cbtIdx=0;_cbtAttemptId=r\.attemptId;\r?\n\s*_cbtSecs=\(r\.quiz\.durationMinutes\|\|30\)\*60;/, 
`_cbtQuestions=questions;
    _cbtAnswers=r.savedAnswers || {};
    _cbtIdx=0;
    _cbtAttemptId=r.attemptId;
    _cbtSubmitting=false;
    _cbtSecs=(r.savedSecs !== undefined && r.savedSecs !== null) ? r.savedSecs : (r.quiz.durationMinutes||30)*60;`);

c = c.replace(/function confirmSubmit\(\)\{\r?\n\s*var ans=Object\.keys\(_cbtAnswers\)\.length,tot=_cbtQuestions\.length;\r?\n\s*if\(ans<tot&&!confirm\('You answered '\+ans\+'\/'\+tot\+'\. Submit anyway\?'\)\)return;\r?\n\s*submitQuiz\(\);\r?\n\s*\}/,
`function confirmSubmit(){
  var ans=Object.keys(_cbtAnswers).length,tot=_cbtQuestions.length;
  if(ans<tot){
    _cbtSubmitting = true;
    var c = confirm('You answered '+ans+'/'+tot+'. Submit anyway?');
    _cbtSubmitting = false;
    if (!c) return;
  }
  submitQuiz();
}`);

c = c.replace(/function submitQuiz\(\)\{/, 'function submitQuiz(){\n  _cbtSubmitting=true;');

const antiCheatCode = `
function handleCBTBlur() {
  if (document.getElementById('cbtOverlay') && document.getElementById('cbtOverlay').style.display === 'flex' && !_cbtSubmitting) {
    _cbtSubmitting = true;
    var answersArray = _cbtQuestions.map(function(q){return{questionId:q.id,selectedOption:_cbtAnswers[q.id]||null};});
    runBackendAction('studentSaveQuizProgress', [AA.token, _cbtAttemptId, answersArray, _cbtSecs]).then(function() {
      alert("Anti-Cheat Warning: You have been logged out because the quiz window lost focus (e.g. minimized or switched tabs). Your progress has been saved.");
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = "Login.html";
    }).catch(function() {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = "Login.html";
    });
  }
}
window.addEventListener('blur', handleCBTBlur);
document.addEventListener('visibilitychange', function() {
  if (document.hidden) handleCBTBlur();
});
</script>
</body>
</html>
`;

c = c.replace(/<\/script>\r?\n\s*<\/body>\r?\n\s*<\/html>/, antiCheatCode);

fs.writeFileSync(p, c);
console.log('Updated StudentDashboard.html');
