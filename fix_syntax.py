import os
files = ['DeveloperDashboard.html', 'AdminDashboard.html', 'HeadTeacherDashboard.html']

for f in files:
    if not os.path.exists(f): continue
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # The erroneous string:
    bad_str = """    function deleteGradingSystem(id) {
      aaConfirm('Are you sure you want to delete this grading system?', function() {
        callServer('adminDeleteGradingSystem', [AA.token, id], function(res) {
          showToast(res.message, res.success ? 'success' : 'error');
          if(res.success) loadGrading();
        }, null, true);
      });
    } }, null, true);
    }"""
    good_str = """    function deleteGradingSystem(id) {
      aaConfirm('Are you sure you want to delete this grading system?', function() {
        callServer('adminDeleteGradingSystem', [AA.token, id], function(res) {
          showToast(res.message, res.success ? 'success' : 'error');
          if(res.success) loadGrading();
        }, null, true);
      });
    }"""
    content = content.replace(bad_str, good_str)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
print("Done")
