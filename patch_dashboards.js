const fs = require('fs');
const path = require('path');
const basePath = 'c:\\\\Users\\\\OASISFAITH\\\\Desktop\\\\Portal Projects\\\\Myschool Portal Cloud Version';
const files = ['DeveloperDashboard.html', 'AdminDashboard.html', 'AdminAssistantDashboard.html'];

files.forEach(f => {
  const p = path.join(basePath, f);
  if(!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  
  // Update select tag
  c = c.replace(/<select\s+id=['"]inviteStudentSelect['"][^>]*>/, '<select id="inviteStudentSelect" class="aa-input" multiple size="4">');
  
  // Update JS
  c = c.replace(/var linkedStudentId = document\.getElementById\('inviteStudentSelect'\)\.value \|\| null;/,
    `var select = document.getElementById('inviteStudentSelect');
      var linkedStudentIds = [];
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].selected && select.options[i].value) {
          linkedStudentIds.push(select.options[i].value);
        }
      }`);
      
  c = c.replace(/callServer\('adminGenerateParentInvite', \[AA\.token, linkedStudentId\]/, "callServer('adminGenerateParentInvite', [AA.token, linkedStudentIds]");

  fs.writeFileSync(p, c);
  console.log('Updated ' + f);
});
