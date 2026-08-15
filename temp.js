
    var currentTerm = ''; var currentSession = '';
    var mySubjects = [];

    document.addEventListener('DOMContentLoaded', function() {
      initTabs('tch-tabs'); AA.init();
      function initDashboard() {
        if (!AA.user || !AA.settings || !AA.settings.current_term) return setTimeout(initDashboard, 100);
        currentTerm = AA.settings.current_term; currentSession = AA.settings.current_session;
        document.getElementById('currentTermText').textContent = currentTerm + ' - ' + currentSession;

        // If this teacher is also a class teacher, reveal the My Class nav and update role labels
        if (AA.user.isClassTeacher) {
          document.getElementById('nav-myclass').style.display = 'flex';
          document.getElementById('nav-traits').style.display = 'flex';
          document.getElementById('sb-teacher-role').textContent = 'Class & Subject Teacher';
          document.getElementById('footer-teacher-role').textContent = 'Class & Subject Teacher';
          var cls = AA.user.classAssigned || '';
          document.getElementById('stat-myclass-name').textContent = cls || 'N/A';
          document.getElementById('stat-myclass-label').textContent = 'Students in ' + (cls || 'My Class');
          document.getElementById('myClassTitle').textContent = cls ? cls + ' - Student Roster' : 'My Class Students';
        }

        loadDashboard();
      }
      initDashboard();
    });

    function loadDashboard() {
      callServer('teacherGetStudentCount', [AA.token], function(count) {
        document.getElementById('stat-students').textContent = count || 0;
      });
      callServer('teacherGetMySubjects', [AA.token], function(data) {
        mySubjects = data;
        document.getElementById('stat-subjects').textContent = data.length;
        buildTable('mySubjectsTable', [
          { key:'subjectName' }, { key:'class', render:function(r){return r.class||'All';} }, { key:'section' }
        ], data, function(r) {
          return '<button class="aa-btn aa-btn-outline aa-btn-xs" onclick="switchTab(\'tch-tabs\',\'tab-scores\'); setTimeout(function(){ document.getElementById(\'scoreSubjectSelect\').value=\''+r.id+'\'; loadStudentsForScoring(); },300);"><i class="fa fa-pen"></i> Enter Grades</button> ' +
                 '<button class="aa-btn aa-btn-primary aa-btn-xs" style="margin-left:5px;" onclick="openSubjectAttendance(\''+r.id+'\', \''+(r.subjectName||'').replace(/'/g, "\\'")+'\', \''+(r.class||'All').replace(/'/g, "\\'")+'\')"><i class="fa fa-calendar-check"></i> Attendance</button>';
        });

        // Populate selects
        var pSel = document.getElementById('planSubject'); pSel.innerHTML='';
        var sSel = document.getElementById('scoreSubjectSelect'); sSel.innerHTML='<option value="">-- Select Subject --</option>';
        data.forEach(function(s) {
          var id = s.id||s.iD;
          var opt = '<option value="'+id+'">'+AA.escapeHTML(s.subjectName)+'</option>';
          pSel.innerHTML += opt; sSel.innerHTML += opt;
        });
      }, null, true);

      callServer('teacherGetMyLessonPlans', [AA.token, currentTerm, currentSession], function(data) {
        document.getElementById('stat-plans').textContent = data.length;
      });
    }

    // -- Scores --
    var currentScoreStudents = [];
    function loadMySubjectsForScores() { if(mySubjects.length===0) loadDashboard(); }

    // -- My Class (class teacher features) --
    var myClassStudents = []; // cached for attendance reuse
    function loadMyClass() {
      if (!AA.user || !AA.user.isClassTeacher) return;
      var cls = AA.user.classAssigned;
      if (!cls) return;
      // Set today's date on the attendance date picker
      var attDateEl = document.getElementById('classAttDate');
      if (attDateEl && !attDateEl.value) attDateEl.valueAsDate = new Date();
      callServer('teacherGetClassStudents', [AA.token, cls], function(data) {
        myClassStudents = data;
        document.getElementById('stat-myclass-students').textContent = myClassStudents.length;
        buildTable('myClassTable', [
          { key: 'admissionNumber' },
          { key: 'fullName' },
          { key: 'status', render: function(r) { return formatStatus(r.status); } }
        ], myClassStudents, function(r) {
          return '<button class="aa-btn aa-btn-gold aa-btn-xs" onclick="viewStudentReport(\'' + (r.id||r.iD) + '\')">' +
                 '<i class="fa fa-eye"></i> View Report</button> ' +
                 '<button class="aa-btn aa-btn-success aa-btn-xs" title="Subjects" onclick="manageEnrollment(\'' + (r.id||r.iD) + '\', \'' + (r.fullName||'').replace(/'/g, "\\'") + '\')">' +
                 '<i class="fa fa-book"></i> Subjects</button>';
        });
      }, null, true);
    }

    function viewStudentReport(sid) {
      var rptType = confirm('Generate a Half-Term report instead of Full-Term?\n\nOK = Half-Term\nCancel = Full-Term') ? 'Half Term' : 'Full Term';
      callServer('principalGetStudentResultPDF', [AA.token, sid, currentTerm, currentSession, rptType], function(res) {
        if (res.success) openPDFViewer(res.previewUrl, res.downloadUrl, 'Report Card');
        else showToast(res.message, 'error');
      }, null, true);
    }

    function generateMyClassBulkResult() {
      var cls = AA.user.classAssigned;
      if (!cls) return showToast('No class assigned.', 'error');
      if (!currentTerm || !currentSession) return showToast('Session not loaded.', 'error');
      var rptType = confirm('Generate a Half-Term report instead of Full-Term?\n\nOK = Half-Term\nCancel = Full-Term') ? 'Half Term' : 'Full Term';
      aaConfirm('Generate ' + rptType + ' bulk results PDF for ' + cls + '?<br><small class="text-muted">This may take a few moments.</small>', function() {
        showToast('Generating bulk results for ' + cls + '...', 'info');
        callServer('adminGenerateBulkResult', [AA.token, cls, currentTerm, currentSession, rptType], function(res) {
          if (res.success) {
            showToast('Bulk results ready!', 'success');
            openPDFViewer(res.previewUrl, res.downloadUrl, cls + ' - Bulk Results');
          } else {
            showToast(res.message || 'Failed to generate results.', 'error');
          }
        }, null, true);
      });
    }

    // -- Class Attendance (class teacher) --
    function loadAttendanceRollCall() {
      var cls = AA.user && AA.user.classAssigned;
      var dt = document.getElementById('classAttDate').value;
      if (!cls || !dt) return;
      if (myClassStudents.length === 0) {
        // Students not yet loaded; fetch then retry
        loadMyClass();
        return setTimeout(loadAttendanceRollCall, 600);
      }
      document.getElementById('classAttCard').style.display = 'block';
      callServer('teacherGetAttendanceByDate', [AA.token, cls, dt], function(attRecords) {
        var tbody = document.querySelector('#classAttTable tbody');
        tbody.innerHTML = '';
        myClassStudents.forEach(function(st) {
          var sid = st.id || st.iD;
          var rec = attRecords.find(function(r) { return String(r.studentID || r.studentId) === String(sid); });
          var status = rec ? rec.status : 'Present';
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + AA.escapeHTML(st.admissionNumber || '') + '</td>' +
            '<td>' + AA.escapeHTML(st.fullName) + '</td>' +
            '<td><select id="clsatt_' + sid + '" class="aa-select" style="padding:4px;width:120px;">' +
            '<option value="Present"' + (status === 'Present' ? ' selected' : '') + '>Present</option>' +
            '<option value="Absent"' + (status === 'Absent' ? ' selected' : '') + '>Absent</option>' +
            '<option value="Late"' + (status === 'Late' ? ' selected' : '') + '>Late</option>' +
            '</select></td>';
          tbody.appendChild(tr);
        });
        document.getElementById('btnSaveClassAttendance').style.display = myClassStudents.length > 0 ? 'inline-block' : 'none';
      }, null, true);
    }

    function saveClassAttendance() {
      var cls = AA.user && AA.user.classAssigned;
      var dt = document.getElementById('classAttDate').value;
      if (!cls || !dt) return showToast('Please select a date.', 'error');
      var records = myClassStudents.map(function(st) {
        var sid = st.id || st.iD;
        return { studentId: sid, status: document.getElementById('clsatt_' + sid).value };
      });
      callServer('teacherMarkAttendance', [AA.token, cls, dt, records, currentTerm, currentSession], function(res) {
        showToast(res.message, res.success ? 'success' : 'error');
      }, null, true);
    }

    var currentScores = [];

    function loadStudentsForScoring() {
      var subId = document.getElementById('scoreSubjectSelect').value;
      if(!subId) { document.getElementById('scoresCard').style.display='none'; document.getElementById('scoreClassSelect').style.display='none'; return; }
      
      callServer('teacherGetSubjectStudents', [AA.token, subId, currentSession], function(students) {
        currentScoreStudents = students;
        
        var classSelect = document.getElementById('scoreClassSelect');
        var prevClass = classSelect.value;
        var classes = [];
        students.forEach(function(st) {
          if (st.className && classes.indexOf(st.className) === -1) classes.push(st.className);
        });
        
        if (classes.length > 0) {
          classSelect.innerHTML = '<option value="">-- Select Class --</option>';
          classes.sort().forEach(function(c) {
            classSelect.innerHTML += '<option value="'+AA.escapeHTML(c)+'">'+AA.escapeHTML(c)+'</option>';
          });
          classSelect.value = prevClass || "";
          classSelect.style.display = 'inline-block';
        } else {
          classSelect.style.display = 'none';
        }

        callServer('teacherGetScores', [AA.token, {subjectId: subId, term: currentTerm, session: currentSession}], function(scores) {
          currentScores = scores;
          renderScoreStudents();
        }, null, true);
      }, null, true);
    }

    function renderScoreStudents() {
      document.getElementById('scoresCard').style.display='block';
      var clsFilter = document.getElementById('scoreClassSelect').value;
      var students = currentScoreStudents;
      if (!clsFilter && document.getElementById('scoreClassSelect').style.display !== 'none') {
        students = [];
      } else if (clsFilter) {
        students = students.filter(function(st) { return st.className === clsFilter; });
      }

      var format = (AA.settings && AA.settings.gradebook_format) ? AA.settings.gradebook_format : [
        { id: 'ca1', title: 'CA1', max: 10 },
        { id: 'ca2', title: 'CA2', max: 10 },
        { id: 'ca3', title: 'CA3', max: 10 },
        { id: 'exam', title: 'Exam', max: 70 }
      ];

      var theadTr = document.getElementById('scoreTableHeader');
      var theadHtml = '<th>Adm No</th><th>Name</th>';
      format.forEach(function(col) {
        theadHtml += '<th style="width:70px;">' + AA.escapeHTML(col.title) + ' (' + col.max + ')</th>';
      });
      theadHtml += '<th>Total</th><th>Grade</th>';
      theadTr.innerHTML = '<tr>' + theadHtml + '</tr>';

      var tbody = document.querySelector('#scoresTable tbody');
      tbody.innerHTML = '';
      var allLocked = students.length>0; var anyScores=false;

      students.forEach(function(st) {
        var sc = currentScores.find(function(x){ return String(x.studentID||x.studentId) === String(st.id||st.iD); }) || {};
        var sid = st.id||st.iD;
        var locked = String(sc.locked) === 'true' || String(sc.submitted) === 'true';
        if(!locked) allLocked = false;
        if(sc.id||sc.iD) anyScores = true;

        var tr = document.createElement('tr');
        var trHtml = '<td>'+AA.escapeHTML(st.admissionNumber||'')+'</td><td>'+AA.escapeHTML(st.fullName)+'</td>';
        
        format.forEach(function(col) {
          var val = sc[col.id] !== undefined ? sc[col.id] : (sc[col.id.toUpperCase()] || 0);
          trHtml += '<td><input type="number" id="'+col.id+'_'+sid+'" class="aa-input" style="padding:4px;" value="'+val+'" max="'+col.max+'" '+(locked?'disabled':'')+'></td>';
        });
        
        trHtml += '<td><strong>'+(sc.total||0)+'</strong></td>'+
          '<td>'+formatGrade(sc.grade||'')+'</td>';
        
        tr.innerHTML = trHtml;
        tbody.appendChild(tr);
      });

      if(students.length===0) tbody.innerHTML = '<tr><td colspan="'+(format.length+4)+'" class="text-center text-muted">No students enrolled in this subject/class yet.</td></tr>';
      
      var canSubmit = students.length > 0 && !allLocked && anyScores;
      var canSave = students.length > 0 && !allLocked;
      document.getElementById('btnSaveAllScores').style.display = canSave ? 'inline-block' : 'none';
      document.getElementById('btnSubmitScores').style.display = canSubmit ? 'inline-block' : 'none';
      document.getElementById('btnDownloadTemplate').style.display = 'inline-block';
      document.getElementById('btnBulkUpload').style.display = 'inline-block';
    }

    function saveAllScores() {
      var subSel = document.getElementById('scoreSubjectSelect');
      var subId = subSel.value;
      if(!subId) return;
      var subName = subSel.options[subSel.selectedIndex].text;
      var payload = [];
      var format = (AA.settings && AA.settings.gradebook_format) ? AA.settings.gradebook_format : [
        { id: 'ca1', title: 'CA1', max: 10 },
        { id: 'ca2', title: 'CA2', max: 10 },
        { id: 'ca3', title: 'CA3', max: 10 },
        { id: 'exam', title: 'Exam', max: 70 }
      ];

      var firstColId = format[0].id;
      var inputs = tbody.querySelectorAll('input[id^="'+firstColId+'_"]');
      inputs.forEach(function(firstInput) {
        if(!firstInput.disabled) {
          var sid = firstInput.id.split('_')[1];
          var tot = 0;
          var scoreData = {
            studentId: sid, subjectId: subId, subjectName: subName, term: currentTerm, session: currentSession
          };
          
          format.forEach(function(col) {
            var inputEl = document.getElementById(col.id+'_'+sid);
            var val = parseFloat(inputEl ? inputEl.value : 0) || 0;
            if (val > col.max) val = col.max; // Cap it
            tot += val;
            scoreData[col.id] = val;
          });
          
          var st = currentScoreStudents.find(function(s) { return String(s.id||s.iD) === String(sid); });
          var clsName = st ? st.className : '';
          var secName = st ? st.section : '';
          var grd = typeof calculateDynamicGrade === 'function' ? calculateDynamicGrade(tot, clsName, secName) : (typeof calculateGrade === 'function' ? calculateGrade(tot) : '');
          
          scoreData.total = tot;
          scoreData.termTotal = tot;
          scoreData.grade = grd;
          scoreData.termGrade = grd;
          
          payload.push(scoreData);
        }
      });
      if(payload.length === 0) return showToast('No editable scores found', 'info');
      
      var btn = document.getElementById('btnSaveAllScores');
      btn.innerText = 'Saving...'; btn.disabled = true;
      callServer('teacherBulkSaveScores', [AA.token, payload], function(res) {
        btn.innerText = 'Save All Scores'; btn.disabled = false;
        showToast(res.message, res.success?'success':'error');
        if(res.success) loadStudentsForScoring();
      }, function() {
        btn.innerText = 'Save All Scores'; btn.disabled = false;
      });
    }

    function submitScores() {
      var subId = document.getElementById('scoreSubjectSelect').value;
      if(!subId) return;
      aaConfirm('Are you sure you want to submit all scores? You will not be able to edit them afterward unless admin unlocks them.', function() {
        callServer('teacherSubmitScores', [AA.token, {subjectId: subId, term: currentTerm, session: currentSession}], function(res) {
          showToast(res.message, res.success?'success':'error');
          if(res.success) loadStudentsForScoring();
        }, null, true);
      });
    }

    // --- BULK SCORES ---
    function downloadScoreTemplate() {
      var tbody = document.querySelector('#scoresTable tbody');
      var rows = tbody.querySelectorAll('tr');
      var format = (AA.settings && AA.settings.gradebook_format) ? AA.settings.gradebook_format : [
        { id: 'ca1', title: 'CA1', max: 10 },
        { id: 'ca2', title: 'CA2', max: 10 },
        { id: 'ca3', title: 'CA3', max: 10 },
        { id: 'exam', title: 'Exam', max: 70 }
      ];
      
      var csv = 'StudentID,StudentName';
      format.forEach(function(col) { csv += ',' + col.title.replace(/,/g, ''); });
      csv += ',TeacherComment\n';
      
      var firstColId = format[0].id;
      rows.forEach(function(tr) {
        if(tr.cells.length < format.length + 2) return;
        var name = tr.cells[1].innerText.replace(/"/g, '""');
        var input = tr.querySelector('input[id^="'+firstColId+'_"]');
        if(input) {
          var sid = input.id.split('_')[1];
          csv += '"' + sid + '","' + name + '"';
          format.forEach(function() { csv += ','; });
          csv += ',\n';
        }
      });
      var subName = document.getElementById('scoreSubjectSelect').options[document.getElementById('scoreSubjectSelect').selectedIndex].text;
      var blob = new Blob([csv], {type: 'text/csv'});
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', subName.replace(/[^a-zA-Z0-9]/g, '_') + '_Scores.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function openBulkScoreModal() {
      document.getElementById('bulkScoreFile').value = '';
      openModal('bulkScoreModal');
    }

    function processBulkScores() {
      var file = document.getElementById('bulkScoreFile').files[0];
      if(!file) return showToast('Please select a file', 'error');
      var subSel = document.getElementById('scoreSubjectSelect');
      var subjectId = subSel.value;
      if(!subjectId) return showToast('Please select a subject first', 'error');
      var subjectName = subSel.options[subSel.selectedIndex].text;
      
      var format = (AA.settings && AA.settings.gradebook_format) ? AA.settings.gradebook_format : [
        { id: 'ca1', title: 'CA1', max: 10 },
        { id: 'ca2', title: 'CA2', max: 10 },
        { id: 'ca3', title: 'CA3', max: 10 },
        { id: 'exam', title: 'Exam', max: 70 }
      ];

      var reader = new FileReader();
      reader.onload = function(e) {
        var parsed = parseCSV(e.target.result);
        var payload = [];
        parsed.forEach(function(row) {
          if(row.StudentID) {
            var scoreData = {
              studentId: row.StudentID,
              subjectId: subjectId,
              subjectName: subjectName,
              className: '',
              term: currentTerm,
              session: currentSession,
              teacherComment: row.TeacherComment || ''
            };
            format.forEach(function(col) {
              // Strip commas and spaces to match object keys from CSV
              var key = col.title.replace(/,/g, '');
              var val = parseFloat(row[key]) || 0;
              if (val > col.max) val = col.max; // Cap it
              scoreData[col.id] = val;
            });
            payload.push(scoreData);
          }
        });
        if(payload.length === 0) return showToast('No valid rows found. Please use the template.', 'error');
        
        document.getElementById('btnProcessScores').innerText = 'Uploading...';
        document.getElementById('btnProcessScores').disabled = true;
        callServer('teacherBulkSaveScores', [AA.token, payload], function(res) {
          document.getElementById('btnProcessScores').innerText = 'Upload Scores';
          document.getElementById('btnProcessScores').disabled = false;
          showToast(res.message, res.success ? 'success' : 'error');
          if(res.success) {
            closeModal('bulkScoreModal');
            loadStudentsForScoring();
          }
        }, function() {
          document.getElementById('btnProcessScores').innerText = 'Upload Scores';
          document.getElementById('btnProcessScores').disabled = false;
        });
      };
      reader.readAsText(file);
    }

    // -- Behavioral Traits --
    function loadTraitsTab() {
      if (myClassStudents.length === 0) {
        loadMyClass();
        setTimeout(loadTraitsTab, 600);
        return;
      }
      var sel = document.getElementById('traitStudentSelect');
      sel.innerHTML = '<option value="">-- Select Student --</option>';
      myClassStudents.forEach(function(s) {
        sel.innerHTML += '<option value="'+(s.id||s.iD)+'">'+AA.escapeHTML(s.fullName)+' ('+AA.escapeHTML(s.admissionNumber||'') + ')</option>';
      });
    }

    function loadStudentTraits() {
      var sid = document.getElementById('traitStudentSelect').value;
      if(!sid) { document.getElementById('traitsFormContainer').style.display='none'; return; }
      
      document.getElementById('psyStudentId').value = sid;
      document.getElementById('affStudentId').value = sid;
      
      callServer('teacherGetPsychomotor', [AA.token, sid, currentTerm, currentSession], function(res) {
        if(res && Object.keys(res).length > 0) setFormData('psyForm', res);
        else document.getElementById('psyForm').reset();
        document.getElementById('psyStudentId').value = sid;
      }, null, true);
      
      callServer('teacherGetAffective', [AA.token, sid, currentTerm, currentSession], function(res) {
        if(res && Object.keys(res).length > 0) setFormData('affForm', res);
        else document.getElementById('affForm').reset();
        document.getElementById('affStudentId').value = sid;
        document.getElementById('traitsFormContainer').style.display='block';
      }, null, true);
    }

    function saveAllTraits() {
      var sid = document.getElementById('traitStudentSelect').value;
      if(!sid) return showToast('Select a student first','error');
      var cls = AA.user.classAssigned;
      
      var psyData = getFormData('psyForm');
      psyData.studentId = sid; psyData.className = cls; psyData.term = currentTerm; psyData.session = currentSession;
      var affData = getFormData('affForm');
      affData.studentId = sid; affData.className = cls; affData.term = currentTerm; affData.session = currentSession;
      
      var btn = document.getElementById('btnSaveTraits');
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; btn.disabled = true;
      
      callServer('teacherSavePsychomotor', [AA.token, psyData], function(r1) {
        callServer('teacherSaveAffective', [AA.token, affData], function(r2) {
          btn.innerHTML = '<i class="fa fa-save"></i> Save Behavioral Traits'; btn.disabled = false;
          showToast('Records saved successfully', 'success');
        }, function() { btn.innerHTML = '<i class="fa fa-save"></i> Save Behavioral Traits'; btn.disabled = false; });
      }, function() { btn.innerHTML = '<i class="fa fa-save"></i> Save Behavioral Traits'; btn.disabled = false; });
    }

    // -- Lesson Plans --
    function loadMyLessonPlans() {
      callServer('teacherGetMyLessonPlans', [AA.token, currentTerm, currentSession], function(data) {
        buildTable('myPlansTable', [
          { key:'topic' }, { key:'subjectName' }, { key:'week' },
          { key:'status', render: function(r){ return formatStatus(r.status); } }
        ], data, function(r) {
          var id = r.id||r.iD;
          var html = '<button class="aa-btn aa-btn-outline aa-btn-xs" onclick="viewPlanPDF(\''+id+'\')"><i class="fa fa-file-pdf"></i></button> ';
          if(r.status === 'draft' || r.status === 'rejected') {
            html += '<button class="aa-btn aa-btn-outline aa-btn-xs" onclick="editLessonPlan(\''+id+'\')"><i class="fa fa-edit"></i></button> ';
            html += '<button class="aa-btn aa-btn-success aa-btn-xs" onclick="submitLessonPlan(\''+id+'\')"><i class="fa fa-paper-plane"></i></button>';
          }
          return html;
        });
      }, null, true);
    }

    function saveLessonPlan() {
      var data = getFormData('planForm');
      data.term = currentTerm; data.session = currentSession;
      var id = data.id;
      var fn = id ? 'teacherUpdateLessonPlan' : 'teacherCreateLessonPlan';
      callServer(fn, [AA.token, id||data, data], function(res) {
        showToast(res.message, res.success?'success':'error');
        if(res.success) { closeModal('planModal'); loadMyLessonPlans(); }
      }, null, true);
    }

    function saveThenSubmitPlan() {
      var data = getFormData('planForm');
      data.term = currentTerm; data.session = currentSession;
      var id = data.id;
      var fn = id ? 'teacherUpdateLessonPlan' : 'teacherCreateLessonPlan';
      var btn = document.getElementById('btnSaveSubmit');
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right:6px;"></i>Saving...';
      callServer(fn, [AA.token, id||data, data], function(res) {
        if (!res.success) {
          btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane" style="margin-right:6px;"></i>Save &amp; Submit';
          return showToast(res.message, 'error');
        }
        var planId = res.id || id;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin" style="margin-right:6px;"></i>Submitting...';
        callServer('teacherSubmitLessonPlan', [AA.token, planId], function(res2) {
          btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane" style="margin-right:6px;"></i>Save &amp; Submit';
          showToast(res2.message, res2.success?'success':'error');
          if(res2.success) { closeModal('planModal'); loadMyLessonPlans(); }
        }, function() { btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane" style="margin-right:6px;"></i>Save &amp; Submit'; }, true);
      }, function() {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane" style="margin-right:6px;"></i>Save &amp; Submit';
      }, true);
    }

    function editLessonPlan(id) {
      callServer('teacherGetMyLessonPlans', [AA.token, currentTerm, currentSession], function(data) {
        var p = data.find(function(x){return String(x.id||x.iD)===String(id);});
        if(p) { document.getElementById('planId').value=id; setFormData('planForm', p); openModal('planModal'); }
      }, null, true);
    }

    function submitLessonPlan(id) {
      aaConfirm('Submit this plan for approval?', function() {
        callServer('teacherSubmitLessonPlan', [AA.token, id], function(res){ showToast(res.message, res.success?'success':'error'); if(res.success)loadMyLessonPlans(); }, null, true);
      });
    }

    function viewPlanPDF(id) {
      callServer('teacherGenerateLessonPlanPDF', [AA.token, id], function(res){
        if(res.success) openPDFViewer(res.previewUrl, res.downloadUrl, 'Lesson Plan');
        else showToast(res.message, 'error');
      }, null, true);
    }

    // --- SUBJECT ATTENDANCE ---
    function openSubjectAttendance(subId, subjectName, className) {
      document.getElementById('subjectAttSubId').value = subId;
      document.getElementById('subjectAttSubjectName').value = subjectName;
      document.getElementById('subjectAttClass').value = className || 'All';
      document.getElementById('subjectAttTitle').textContent = subjectName + ' Attendance (' + (className || 'All') + ')';
      document.getElementById('subjectAttDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('subjectAttContainer').style.display = 'none';
      document.getElementById('btnSaveSubjectAtt').style.display = 'none';
      openModal('subjectAttModal');
    }
    
    function loadSubjectAttendance() {
      var date = document.getElementById('subjectAttDate').value;
      var className = document.getElementById('subjectAttClass').value;
      var subjectName = document.getElementById('subjectAttSubjectName').value;
      var subId = document.getElementById('subjectAttSubId').value;
      if (!date || !subjectName || !subId) return showToast('Missing information','error');
      
      callServer('teacherGetSubjectAttendance', [AA.token, {className: className, subjectName: subjectName, date: date}], function(res) {
        var existing = res.success ? res.data : [];
        callServer('teacherGetSubjectStudents', [AA.token, subId, AA.settings.current_session, AA.settings.current_term], function(studentsData) {
          if (!studentsData || studentsData.length === 0) return showToast('No students enrolled in this subject','warning');
          
          var tbody = document.querySelector('#subjectAttTable tbody');
          tbody.innerHTML = '';
          studentsData.forEach(function(st) {
             var stId = st.id || st.iD || st.studentId;
             var stName = st.fullName || ((st.firstName||'') + ' ' + (st.lastName||''));
             var rec = existing.find(function(x) { return String(x.studentId) === String(stId); });
             var stat = rec ? rec.status : 'Present'; 
             
             var sel = '<select class="aa-select" data-studentid="'+stId+'">' +
               '<option value="Present" '+(stat==='Present'?'selected':'')+'>Present</option>' +
               '<option value="Absent" '+(stat==='Absent'?'selected':'')+'>Absent</option>' +
               '<option value="Late" '+(stat==='Late'?'selected':'')+'>Late</option>' +
               '</select>';
             
             tbody.innerHTML += '<tr><td>'+stName+'</td><td>'+sel+'</td></tr>';
          });
          document.getElementById('subjectAttContainer').style.display = 'block';
          document.getElementById('btnSaveSubjectAtt').style.display = 'inline-block';
        });
      });
    }

    function saveSubjectAttendance() {
      var date = document.getElementById('subjectAttDate').value;
      var className = document.getElementById('subjectAttClass').value;
      var subjectName = document.getElementById('subjectAttSubjectName').value;
      if(!date || !className || !subjectName) return showToast('Missing information','error');
      
      var selects = document.querySelectorAll('#subjectAttTable tbody select');
      var records = [];
      selects.forEach(function(s) {
        records.push({ studentId: s.getAttribute('data-studentid'), status: s.value });
      });
      
      var data = {
        date: date,
        className: className,
        subjectName: subjectName,
        term: AA.settings.current_term,
        session: AA.settings.current_session,
        records: records
      };
      
      var btn = document.getElementById('btnSaveSubjectAtt');
      btn.innerHTML = 'Saving...'; btn.disabled = true;
      callServer('teacherSaveSubjectAttendance', [AA.token, data], function(res) {
        btn.innerHTML = 'Save Attendance'; btn.disabled = false;
        showToast(res.message, res.success ? 'success' : 'error');
        if (res.success) closeModal('subjectAttModal');
      }, function() { btn.innerHTML = 'Save Attendance'; btn.disabled = false; }, false);
    }

    // --- SUBJECT ENROLLMENT ---
    function manageEnrollment(studentId, studentName) {
      document.getElementById('enrollment-student-info').textContent = 'Managing Subjects for: ' + studentName;
      loadEnrollmentData(studentId);
      openModal('enrollmentModal');
    }
    var currentEnrollment = { enrolled: [], available: [] };
    function loadEnrollmentData(sid, showLoader) {
      if (showLoader === undefined) showLoader = true;
      callServer('teacherGetStudentSubjects', [AA.token, sid], function(data) {
        currentEnrollment.enrolled = data.enrolled || [];
        currentEnrollment.available = data.available || [];
        renderEnrollmentLists(sid);
      }, null, showLoader);
    }
    function renderEnrollmentLists(sid) {
      var availHtml = '';
      currentEnrollment.available.forEach(function(s) {
        var subId = s.id || s.iD;
        var sectionLabel = s.section === 'primary' ? 'Primary' : 'High';
        var classLabel = s.class || s.className || 'All';
        availHtml += '<div class="d-flex justify-content-between align-items-center mb-1 fs-12 p-1 border-bottom">' +
                     '<span>'+s.subjectName+' <span class="aa-badge aa-badge-'+(s.section==='primary'?'info':'navy')+'" style="font-size:9px;">'+sectionLabel+'</span> ('+classLabel+')</span>' +
                     '<button class="aa-btn aa-btn-success aa-btn-xs" onclick="enrollSubject(\''+sid+'\', \''+subId+'\')">Add</button></div>';
      });
      document.getElementById('available-subjects').innerHTML = availHtml || 'No more subjects available';

      var enrolHtml = '';
      currentEnrollment.enrolled.forEach(function(s) {
        var subId = s.id || s.iD;
        enrolHtml += '<div class="d-flex justify-content-between align-items-center mb-1 fs-12 p-1 border-bottom">' +
                     '<span>'+s.subjectName+'</span>' +
                     '<button class="aa-btn aa-btn-danger aa-btn-xs" onclick="unenrollSubject(\''+sid+'\', \''+subId+'\')">Remove</button></div>';
      });
      document.getElementById('enrolled-subjects').innerHTML = enrolHtml || 'No subjects enrolled';
    }
    function enrollSubject(sid, subid) {
      var idx = currentEnrollment.available.findIndex(function(s) { return String(s.id || s.iD) === String(subid); });
      if (idx !== -1) {
        var subject = currentEnrollment.available.splice(idx, 1)[0];
        currentEnrollment.enrolled.push(subject);
        renderEnrollmentLists(sid);
      }
      callServer('teacherEnrollStudent', [AA.token, sid, subid, AA.settings.current_session, AA.settings.current_term], function(res) {
        showToast(res.message, res.success ? 'success' : 'error');
        if(!res.success) loadEnrollmentData(sid, false);
      }, function() {
        loadEnrollmentData(sid, false);
      }, false);
    }

    // ==========================================
    // TEACHER CONTENT - ASSIGNMENTS
    // ==========================================
    var currentAssignmentId = null;
    function loadMyAssignments() {
      var container = document.getElementById('myAssignmentsList');
      container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Loading...</p></div>';
      callServer('teacherGetMyAssignments', [AA.token], function(res) {
        if (!res.success) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-exclamation-triangle"></i><p>Failed to load assignments.</p></div>'; return; }
        if (!res.data || res.data.length === 0) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-clipboard-list"></i><p>No assignments found.</p></div>'; return; }
        var html = '<table class="aa-table"><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Due Date</th><th>Actions</th></tr></thead><tbody>';
        res.data.forEach(function(a) {
          html += '<tr>';
          html += '<td><strong>' + AA.escapeHTML(a.title) + '</strong></td>';
          html += '<td>' + AA.escapeHTML(a.subjectName || 'All Subjects') + '</td>';
          html += '<td>' + AA.escapeHTML(a.className || 'All Classes') + '</td>';
          html += '<td>' + (a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-GB') : 'No Due Date') + '</td>';
          html += '<td>';
          html += '<button class="aa-btn aa-btn-outline aa-btn-xs" style="margin-right:8px;" onclick=\'editAssignment(' + JSON.stringify(a) + ')\'><i class="fa fa-edit"></i> Edit</button>';
          html += '<button class="aa-btn aa-btn-danger aa-btn-xs" onclick="deleteAssignment(\'' + a.id + '\')"><i class="fa fa-trash"></i> Delete</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      }, function() {
        container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-wifi"></i><p>Connection error.</p></div>';
      });
    }
    function populateContentDropdowns(prefix) {
      var selSub = document.getElementById(prefix + 'Subject');
      var selCls = document.getElementById(prefix + 'Class');
      selSub.innerHTML = '<option value="">All Subjects</option>';
      selCls.innerHTML = '<option value="">All Classes</option>';
      if (AA.mySubjects) {
        var addedSub = {}; var addedCls = {};
        AA.mySubjects.forEach(function(s) {
          if (!addedSub[s.subjectName]) { addedSub[s.subjectName] = true; selSub.innerHTML += '<option value="' + AA.escapeHTML(s.subjectName) + '">' + AA.escapeHTML(s.subjectName) + '</option>'; }
          if (!addedCls[s.className]) { addedCls[s.className] = true; selCls.innerHTML += '<option value="' + AA.escapeHTML(s.className) + '">' + AA.escapeHTML(s.className) + '</option>'; }
        });
      }
    }
    function openAssignmentModal() {
      currentAssignmentId = null;
      document.getElementById('asgTitle').value = '';
      populateContentDropdowns('asg');
      document.getElementById('asgDueDate').value = '';
      document.getElementById('asgDescription').value = '';
      openModal('assignmentModal');
    }
    function editAssignment(a) {
      currentAssignmentId = a.id;
      document.getElementById('asgTitle').value = a.title || '';
      populateContentDropdowns('asg');
      document.getElementById('asgSubject').value = a.subjectName || '';
      document.getElementById('asgClass').value = a.className || '';
      document.getElementById('asgDueDate').value = a.dueDate || '';
      document.getElementById('asgDescription').value = a.description || '';
      openModal('assignmentModal');
    }
    function saveAssignment() {
      var title = document.getElementById('asgTitle').value.trim();
      var desc = document.getElementById('asgDescription').value.trim();
      if (!title || !desc) { showToast('Title and Description are required.', 'error'); return; }
      var btn = document.getElementById('btnSaveAssignment');
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      var data = {
        id: currentAssignmentId,
        title: title,
        subjectName: document.getElementById('asgSubject').value,
        className: document.getElementById('asgClass').value,
        dueDate: document.getElementById('asgDueDate').value,
        description: desc
      };
      callServer('teacherSaveAssignment', [AA.token, data], function(res) {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save Assignment';
        if (res.success) { showToast(res.message, 'success'); closeModal('assignmentModal'); loadMyAssignments(); }
        else showToast(res.message, 'error');
      }, function() {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save Assignment';
        showToast('Connection error.', 'error');
      });
    }
    function deleteAssignment(id) {
      if (!confirm('Delete this assignment?')) return;
      callServer('teacherDeleteAssignment', [AA.token, id], function(res) {
        if (res.success) { showToast(res.message, 'success'); loadMyAssignments(); }
        else showToast(res.message, 'error');
      });
    }

    // ==========================================
    // TEACHER CONTENT - LESSON NOTES
    // ==========================================
    var noteFileData = '', noteFileMime = '', noteFileName = '';
    function loadMyNotes() {
      var container = document.getElementById('myNotesList');
      container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Loading...</p></div>';
      callServer('teacherGetMyNotes', [AA.token], function(res) {
        if (!res.success) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-exclamation-triangle"></i><p>Failed to load notes.</p></div>'; return; }
        if (!res.data || res.data.length === 0) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-file-alt"></i><p>No notes found.</p></div>'; return; }
        var html = '<table class="aa-table"><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Uploaded</th><th>Expires</th><th>Actions</th></tr></thead><tbody>';
        res.data.forEach(function(n) {
          var created = n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB') : '-';
          var expires = n.expiresAt ? new Date(n.expiresAt).toLocaleDateString('en-GB') : '-';
          html += '<tr>';
          html += '<td><strong>' + AA.escapeHTML(n.title) + '</strong></td>';
          html += '<td>' + AA.escapeHTML(n.subjectName || 'All Subjects') + '</td>';
          html += '<td>' + AA.escapeHTML(n.className || 'All Classes') + '</td>';
          html += '<td>' + created + '</td>';
          html += '<td>' + expires + (n.expired ? ' <span style="color:#ef4444;font-size:10px;">(Expired)</span>' : '') + '</td>';
          html += '<td>';
          html += '<button class="aa-btn aa-btn-danger aa-btn-xs" onclick="deleteNote(\'' + n.id + '\')"><i class="fa fa-trash"></i> Delete</button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      });
    }
    function openNoteModal() {
      document.getElementById('noteTitle').value = '';
      populateContentDropdowns('note');
      document.getElementById('noteFile').value = '';
      document.getElementById('noteFileInfo').textContent = '';
      noteFileData = ''; noteFileMime = ''; noteFileName = '';
      openModal('noteModal');
    }
    function handleNoteFile(input) {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      if (file.size > 10 * 1024 * 1024) { alert('File too large. Maximum size is 10MB.'); input.value = ''; return; }
      noteFileName = file.name;
      noteFileMime = file.type || 'application/octet-stream';
      document.getElementById('noteFileInfo').innerHTML = '<i class="fa fa-check text-success"></i> ' + AA.escapeHTML(file.name) + ' (' + (file.size/1024).toFixed(1) + ' KB)';
      var reader = new FileReader();
      reader.onload = function(e) {
        var res = e.target.result;
        noteFileData = res.split(',')[1];
      };
      reader.readAsDataURL(file);
    }
    function saveNote() {
      var title = document.getElementById('noteTitle').value.trim();
      if (!title) { showToast('Note Title is required.', 'error'); return; }
      if (!noteFileData) { showToast('Please select a file to upload.', 'error'); return; }
      var btn = document.getElementById('btnSaveNote');
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
      var data = {
        title: title,
        subjectName: document.getElementById('noteSubject').value,
        className: document.getElementById('noteClass').value,
        fileName: noteFileName,
        mimeType: noteFileMime,
        fileData: noteFileData
      };
      callServer('teacherSaveNote', [AA.token, data], function(res) {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-upload"></i> Upload Note';
        if (res.success) { showToast(res.message, 'success'); closeModal('noteModal'); loadMyNotes(); }
        else showToast(res.message, 'error');
      }, function() {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-upload"></i> Upload Note';
        showToast('Connection error.', 'error');
      });
    }
    function deleteNote(id) {
      if (!confirm('Delete this lesson note?')) return;
      callServer('teacherDeleteNote', [AA.token, id], function(res) {
        if (res.success) { showToast(res.message, 'success'); loadMyNotes(); }
        else showToast(res.message, 'error');
      });
    }

    // ==========================================
    // TEACHER CONTENT - CBT QUIZZES
    // ==========================================
    var currentQuizId = null;
    function loadMyQuizzes() {
      var container = document.getElementById('myQuizzesList');
      container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Loading...</p></div>';
      callServer('teacherGetMyQuizzes', [AA.token], function(res) {
        if (!res.success) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-exclamation-triangle"></i><p>Failed to load quizzes.</p></div>'; return; }
        if (!res.data || res.data.length === 0) { container.innerHTML = '<div class="aa-empty-state"><i class="fa fa-tasks"></i><p>No CBT quizzes found.</p></div>'; return; }
        var html = '<table class="aa-table"><thead><tr><th>Title</th><th>Subject</th><th>Class</th><th>Questions</th><th>Attempts</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        res.data.forEach(function(q) {
          html += '<tr>';
          html += '<td><strong>' + AA.escapeHTML(q.title) + '</strong><br><small style="color:var(--aa-text-muted);">' + (q.durationMinutes||30) + ' mins</small></td>';
          html += '<td>' + AA.escapeHTML(q.subjectName || 'All') + '</td>';
          html += '<td>' + AA.escapeHTML(q.className || 'All') + '</td>';
          html += '<td>' + (q.questionCount || 0) + '</td>';
          html += '<td>' + (q.attemptCount || 0) + '</td>';
          html += '<td>' + (q.isPublished ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-warning">Draft</span>') + '</td>';
          html += '<td style="white-space:nowrap;">';
          if (!q.isPublished) html += '<button class="aa-btn aa-btn-outline aa-btn-xs" style="margin-right:6px;" onclick="publishQuiz(\'' + q.id + '\', true)"><i class="fa fa-eye"></i> Publish</button>';
          else html += '<button class="aa-btn aa-btn-outline aa-btn-xs" style="margin-right:6px;" onclick="publishQuiz(\'' + q.id + '\', false)"><i class="fa fa-eye-slash"></i> Unpublish</button>';
          html += '<button class="aa-btn aa-btn-outline aa-btn-xs" style="margin-right:6px;" onclick=\'editQuiz(' + JSON.stringify(q) + ')\'><i class="fa fa-edit"></i> Edit</button>';
          html += '<button class="aa-btn aa-btn-outline aa-btn-xs" style="margin-right:6px;" onclick="manageQuizQuestions(\'' + q.id + '\')"><i class="fa fa-list"></i> Questions</button>';
          if (q.attemptCount > 0) html += '<button class="aa-btn aa-btn-primary aa-btn-xs" style="margin-right:6px;" onclick="viewQuizResults(\'' + q.id + '\')"><i class="fa fa-chart-bar"></i> Results</button>';
          html += '<button class="aa-btn aa-btn-danger aa-btn-xs" onclick="deleteQuiz(\'' + q.id + '\')"><i class="fa fa-trash"></i></button>';
          html += '</td></tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
      });
    }
    function openQuizModal() {
      currentQuizId = null;
      document.getElementById('quizTitle').value = '';
      populateContentDropdowns('quiz');
      document.getElementById('quizDuration').value = '30';
      openModal('quizModal');
    }
    function editQuiz(q) {
      currentQuizId = q.id;
      document.getElementById('quizTitle').value = q.title || '';
      populateContentDropdowns('quiz');
      document.getElementById('quizSubject').value = q.subjectName || '';
      document.getElementById('quizClass').value = q.className || '';
      document.getElementById('quizDuration').value = q.durationMinutes || 30;
      openModal('quizModal');
    }
    function saveQuiz() {
      var title = document.getElementById('quizTitle').value.trim();
      if (!title) { showToast('Quiz Title is required.', 'error'); return; }
      var btn = document.getElementById('btnSaveQuiz');
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      var data = {
        id: currentQuizId,
        title: title,
        subjectName: document.getElementById('quizSubject').value,
        className: document.getElementById('quizClass').value,
        durationMinutes: parseInt(document.getElementById('quizDuration').value) || 30
      };
      callServer('teacherSaveQuiz', [AA.token, data], function(res) {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save Quiz';
        if (res.success) { showToast(res.message, 'success'); closeModal('quizModal'); loadMyQuizzes(); }
        else showToast(res.message, 'error');
      });
    }
    function deleteQuiz(id) {
      if (!confirm('WARNING: Deleting this quiz will also delete all questions and student results. Continue?')) return;
      callServer('teacherDeleteQuiz', [AA.token, id], function(res) {
        if (res.success) { showToast(res.message, 'success'); loadMyQuizzes(); }
        else showToast(res.message, 'error');
      });
    }
    function publishQuiz(id, pub) {
      if (pub && !confirm('Publishing will make this quiz available to students immediately. Proceed?')) return;
      callServer('teacherPublishQuiz', [AA.token, id, pub], function(res) {
        if (res.success) { showToast(res.message, 'success'); loadMyQuizzes(); }
        else showToast(res.message, 'error');
      });
    }

    // -- Quiz Questions Editor --
    var currentQuizQuestions = [];
    var editQuizId = null;
    function manageQuizQuestions(quizId) {
      editQuizId = quizId;
      document.getElementById('questionEditorList').innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i></div>';
      openModal('questionsModal');
      callServer('teacherGetQuizQuestions', [AA.token, quizId], function(res) {
        if (res.success) {
          currentQuizQuestions = res.data || [];
          if (currentQuizQuestions.length === 0) currentQuizQuestions.push(createEmptyQuestion());
          renderQuestionEditor();
        } else {
          document.getElementById('questionEditorList').innerHTML = '<div class="aa-empty-state">Error loading questions.</div>';
        }
      });
    }
    function createEmptyQuestion() { return { question: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' }; }
    function renderQuestionEditor() {
      var html = '';
      currentQuizQuestions.forEach(function(q, i) {
        html += '<div class="aa-card" style="margin-bottom:12px;padding:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<h4 style="font-size:14px;font-weight:700;">Question ' + (i+1) + '</h4>';
        html += '<button class="aa-btn aa-btn-danger aa-btn-xs" onclick="removeQuestion(' + i + ')"><i class="fa fa-times"></i> Remove</button>';
        html += '</div>';
        html += '<div class="aa-form-group"><textarea class="aa-input" rows="2" placeholder="Enter question..." oninput="updateQ(' + i + ',\'question\',this.value)">' + AA.escapeHTML(q.question) + '</textarea></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
        html += '<div class="aa-form-group" style="margin:0;"><input type="text" class="aa-input" placeholder="Option A" value="' + AA.escapeHTML(q.optionA) + '" oninput="updateQ(' + i + ',\'optionA\',this.value)"></div>';
        html += '<div class="aa-form-group" style="margin:0;"><input type="text" class="aa-input" placeholder="Option B" value="' + AA.escapeHTML(q.optionB) + '" oninput="updateQ(' + i + ',\'optionB\',this.value)"></div>';
        html += '<div class="aa-form-group" style="margin:0;"><input type="text" class="aa-input" placeholder="Option C" value="' + AA.escapeHTML(q.optionC) + '" oninput="updateQ(' + i + ',\'optionC\',this.value)"></div>';
        html += '<div class="aa-form-group" style="margin:0;"><input type="text" class="aa-input" placeholder="Option D" value="' + AA.escapeHTML(q.optionD) + '" oninput="updateQ(' + i + ',\'optionD\',this.value)"></div>';
        html += '</div>';
        html += '<div class="aa-form-group" style="margin:0;width:150px;"><label class="aa-label" style="display:inline;margin-right:8px;">Correct Answer:</label>';
        html += '<select class="aa-input" style="display:inline-block;width:auto;padding:4px 8px;" onchange="updateQ(' + i + ',\'correctAnswer\',this.value)">';
        ['A','B','C','D'].forEach(function(opt) { html += '<option value="' + opt + '" ' + (q.correctAnswer===opt?'selected':'') + '>' + opt + '</option>'; });
        html += '</select></div>';
        html += '</div>';
      });
      document.getElementById('questionEditorList').innerHTML = html;
    }
    window.updateQ = function(i, k, v) { currentQuizQuestions[i][k] = v; }; // Expose to global for oninput
    function addBlankQuestion() { currentQuizQuestions.push(createEmptyQuestion()); renderQuestionEditor(); }
    function removeQuestion(i) { currentQuizQuestions.splice(i, 1); renderQuestionEditor(); }
    function saveQuestions() {
      var valid = currentQuizQuestions.filter(function(q) { return q.question && q.question.trim().length > 0; });
      var btn = document.getElementById('btnSaveQuestions');
      btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      callServer('teacherSaveQuestions', [AA.token, editQuizId, valid], function(res) {
        btn.disabled = false; btn.innerHTML = '<i class="fa fa-save"></i> Save All Questions';
        if (res.success) { showToast(res.message, 'success'); closeModal('questionsModal'); loadMyQuizzes(); }
        else showToast(res.message, 'error');
      });
    }

    // -- Bulk Upload --
    function toggleBulkUpload() {
      var el = document.getElementById('bulkUploadArea');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
    function parseBulkQuestions() {
      var text = document.getElementById('bulkQText').value;
      if (!text.trim()) return;
      var blocks = text.split(/\n\s*\n/);
      var added = 0;
      blocks.forEach(function(b) {
        var lines = b.split('\n').map(function(l){return l.trim();}).filter(Boolean);
        var qObj = createEmptyQuestion();
        lines.forEach(function(l) {
          if (l.match(/^Q:/i)) qObj.question = l.replace(/^Q:\s*/i, '');
          else if (l.match(/^A:/i)) qObj.optionA = l.replace(/^A:\s*/i, '');
          else if (l.match(/^B:/i)) qObj.optionB = l.replace(/^B:\s*/i, '');
          else if (l.match(/^C:/i)) qObj.optionC = l.replace(/^C:\s*/i, '');
          else if (l.match(/^D:/i)) qObj.optionD = l.replace(/^D:\s*/i, '');
          else if (l.match(/^ANS:/i)) qObj.correctAnswer = l.replace(/^ANS:\s*/i, '').trim().toUpperCase();
        });
        if (qObj.question) { currentQuizQuestions.push(qObj); added++; }
      });
      document.getElementById('bulkQText').value = '';
      toggleBulkUpload();
      renderQuestionEditor();
      showToast(added + ' questions parsed from text.', 'success');
    }

    function viewQuizResults(quizId) {
      document.getElementById('quizResultsBody').innerHTML = '<div class="aa-empty-state"><i class="fa fa-spinner fa-spin fa-2x"></i></div>';
      openModal('quizResultsModal');
      callServer('teacherGetQuizResults', [AA.token, quizId], function(res) {
        if (!res.success) { document.getElementById('quizResultsBody').innerHTML = '<div class="aa-empty-state">Failed to load results.</div>'; return; }
        if (!res.data || res.data.length === 0) { document.getElementById('quizResultsBody').innerHTML = '<div class="aa-empty-state">No students have taken this quiz yet.</div>'; return; }
        var html = '<table class="aa-table"><thead><tr><th>Student</th><th>Class</th><th>Score</th><th>Submitted</th></tr></thead><tbody>';
        res.data.forEach(function(r) {
          html += '<tr><td><strong>' + AA.escapeHTML(r.studentName) + '</strong></td>';
          html += '<td>' + AA.escapeHTML(r.className) + '</td>';
          html += '<td><span style="font-weight:700;color:' + (r.percentage>=50?'#4ade80':'#ef4444') + ';">' + r.score + '/' + r.total + ' (' + r.percentage + '%)</span></td>';
          html += '<td>' + new Date(r.submittedAt).toLocaleString('en-GB') + '</td></tr>';
        });
        html += '</tbody></table>';
        document.getElementById('quizResultsBody').innerHTML = html;
      });
    }

  