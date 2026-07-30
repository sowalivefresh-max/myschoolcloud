module.exports = {
  getReportCSS: function() {
    let html = '<style>';
    html += 'body{font-family:"Times New Roman",serif;margin:0;padding:0;color:#1a1a1a;font-size:10.5px;}';
    html += '.wrap{max-width:780px;margin:0 auto;border:3px double #0d1b2a;padding:8px;box-sizing:border-box;}';
    html += '.hdr{display:flex;align-items:center;border-bottom:2px solid #0d1b2a;padding-bottom:6px;margin-bottom:6px;}';
    html += '.logo{width:60px;height:60px;object-fit:contain;margin-right:15px;}';
    html += '.logo-ph{width:60px;height:60px;background:#0d1b2a;display:flex;align-items:center;justify-content:center;color:#f0a500;font-weight:bold;font-size:14px;margin-right:15px;}';
    html += '.school-info{flex:1;text-align:center;}';
    html += '.school-name{font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#0d1b2a;}';
    html += '.school-motto{font-size:10px;font-style:italic;color:#555;margin:2px 0;}';
    html += '.rpt-title{font-size:12px;font-weight:bold;text-transform:uppercase;background:#0d1b2a;color:#f0a500;padding:3px 10px;display:inline-block;margin-top:4px;}';
    html += '.bio-box{display:flex;border:1px solid #ccc;margin-bottom:6px;}';
    html += '.bio-data{flex:1;padding:4px;}';
    html += '.bio-row{display:flex;margin-bottom:2px;}';
    html += '.bio-label{font-weight:bold;width:100px;flex-shrink:0;}';
    html += '.passport{width:70px;border-left:1px solid #ccc;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:9px;color:#888;text-align:center;padding:3px;}';
    html += 'table{width:100%;border-collapse:collapse;margin:4px 0;font-size:10px;}';
    html += 'th{background:#0d1b2a;color:#f0a500;padding:3px 2px;border:1px solid #0d1b2a;text-align:center;}';
    html += 'td{padding:2px;border:1px solid #ccc;text-align:center;}';
    html += 'tr:nth-child(even){background:#f8f8f8;}';
    html += '.sec-title{font-weight:bold;font-size:11px;background:#e8ecf0;padding:3px 6px;margin:6px 0 2px;border-left:3px solid #0d1b2a;}';
    html += '.summary-grid{display:flex;gap:6px;margin:4px 0;}';
    html += '.sum-box{flex:1;border:1px solid #ccc;padding:4px;text-align:center;}';
    html += '.sum-val{font-size:14px;font-weight:bold;color:#0d1b2a;}';
    html += '.sum-lbl{font-size:9px;color:#666;}';
    html += '.comment-box{border:1px solid #ccc;padding:4px;margin:4px 0;font-size:10px;}';
    html += '.sig-row{display:flex;justify-content:space-between;margin-top:10px;}';
    html += '.sig-box{text-align:center;width:30%;}';
    html += '.sig-line{border-top:1px solid #333;margin-top:20px;padding-top:2px;font-size:9px;}';
    html += '.footer{text-align:center;margin-top:8px;font-size:8px;color:#888;border-top:1px solid #e0e0e0;padding-top:4px;}';
    html += '.grade-a{color:#16a34a;font-weight:bold;} .grade-b{color:#2563eb;font-weight:bold;} .grade-c{color:#d97706;font-weight:bold;} .grade-f{color:#dc2626;font-weight:bold;}';
    html += '.att-box{display:flex;gap:8px;margin:6px 0;}';
    html += '.att-item{flex:1;border:1px solid #ccc;padding:5px;text-align:center;}';
    html += '.page-break { page-break-after: always; }';
    html += '</style>';
    return html;
  },

  generateStudentReportHTML: function(report, cfg) {
    const s = report.student || {};
    const scores = report.scores || [];
    const summary = report.summary || {};
    const att = report.attendance || { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };
    const psy = report.psychomotor || {};
    const aff = report.affective || {};
    const term = report.term || '';
    const session = report.session || '';

    let html = '<!DOCTYPE html><html><head><meta charset="utf-8">';
    html += this.getReportCSS();
    html += '</head><body><div class="wrap">';

    // Header
    html += '<div class="hdr">';
    html += '<div class="logo-ph">Logo</div>'; // Client handles logo or uses base64
    html += '<div class="school-info">';
    html += '<div class="school-name">' + (cfg.schoolName || "MySchool Portal") + '</div>';
    if (cfg.schoolMotto) html += '<div class="school-motto">"' + cfg.schoolMotto + '"</div>';
    html += '<div style="font-size:11px;color:#555;margin:2px 0;">Academic Report Card</div>';
    html += '<div class="rpt-title">' + term + ' Report - ' + session + '</div>';
    html += '</div>';
    html += '<div class="logo-ph" style="margin-right:0; margin-left:15px; background:#f5f5f5; color:#888; border:1px solid #ccc; font-size:10px; text-align:center; line-height:1.2;">Passport<br>Photo</div>';
    html += '</div>';

    // Biodata
    html += '<div class="bio-box"><div class="bio-data">';
    html += '<div class="bio-row"><span class="bio-label">Student Name:</span><span>' + (s.fullName || '') + '</span></div>';
    html += '<div class="bio-row"><span class="bio-label">Admission No:</span><span>' + (s.admissionNumber || '') + '</span></div>';
    html += '<div class="bio-row"><span class="bio-label">Class:</span><span>' + (s.className || '') + '</span></div>';
    html += '<div class="bio-row"><span class="bio-label">Gender:</span><span>' + (s.gender || '') + '</span></div>';
    html += '<div class="bio-row"><span class="bio-label">Session:</span><span>' + session + '</span></div>';
    html += '</div></div>';

    // Summary
    html += '<div class="summary-grid">';
    html += '<div class="sum-box"><div class="sum-val">' + scores.length + '</div><div class="sum-lbl">Subjects</div></div>';
    html += '<div class="sum-box"><div class="sum-val">' + (summary.average || 0) + '%</div><div class="sum-lbl">Average</div></div>';
    html += '<div class="sum-box"><div class="sum-val">' + (summary.overallGrade || 'N/A') + '</div><div class="sum-lbl">Overall Grade</div></div>';
    html += '<div class="sum-box"><div class="sum-val">' + (att.percentage || 0) + '%</div><div class="sum-lbl">Attendance</div></div>';
    html += '</div>';

    // Scores Table
    html += '<div class="sec-title">Academic Performance</div>';
    html += '<table><tr><th>S/N</th><th>Subject</th><th>CA1</th><th>CA2</th><th>CA3</th><th>Exam</th><th>Total</th><th>Grade</th></tr>';

    for (let i = 0; i < scores.length; i++) {
      let sc = scores[i];
      let g = sc.termGrade || 'F9';
      let gcls = (g === 'A1') ? 'grade-a' : (g === 'B2' || g === 'B3') ? 'grade-b' : (g.startsWith('C')) ? 'grade-c' : 'grade-f';
      
      html += '<tr><td>' + (i + 1) + '</td>';
      html += '<td style="text-align:left;padding-left:6px;">' + (sc.subjectName || '') + '</td>';
      html += '<td>' + (sc.cA1 || sc.ca1 || 0) + '</td><td>' + (sc.cA2 || sc.ca2 || 0) + '</td><td>' + (sc.cA3 || sc.ca3 || 0) + '</td>';
      html += '<td>' + (sc.exam || sc.Exam || 0) + '</td>';
      html += '<td><strong>' + (sc.total || sc.termTotal || 0) + '</strong></td>';
      html += '<td class="' + gcls + '">' + g + '</td></tr>';
    }
    html += '</table>';

    html += '<div class="sec-title">Psychomotor & Affective Skills</div>';
    html += '<div style="display:flex; gap:10px;">';
    // Psychomotor
    html += '<div style="flex:1;"><table><tr><th>Psychomotor Skill</th><th>Rating</th></tr>';
    html += '<tr><td>Handwriting</td><td>' + (psy.handwriting || '-') + '</td></tr>';
    html += '<tr><td>Sport Skills</td><td>' + (psy.sportSkills || '-') + '</td></tr>';
    html += '<tr><td>Creativity</td><td>' + (psy.creativity || '-') + '</td></tr>';
    html += '</table></div>';
    // Affective
    html += '<div style="flex:1;"><table><tr><th>Affective Trait</th><th>Rating</th></tr>';
    html += '<tr><td>Punctuality</td><td>' + (aff.punctuality || '-') + '</td></tr>';
    html += '<tr><td>Neatness</td><td>' + (aff.neatness || '-') + '</td></tr>';
    html += '<tr><td>Honesty</td><td>' + (aff.honesty || '-') + '</td></tr>';
    html += '</table></div>';
    html += '</div>';

    html += '<div class="sig-row">';
    html += '<div class="sig-box"><div class="sig-line">Form Teacher\'s Signature</div></div>';
    html += '<div class="sig-box"><div class="sig-line">Principal\'s Signature</div></div>';
    html += '</div>';

    html += '<div class="footer">Generated by MySchool Portal Cloud Engine</div>';
    html += '</div></body></html>';
    return html;
  },

  generateStudentIdCardHTML: function(student, cfg) {
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card</title><style>';
    html += 'body { font-family: "Inter", "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f6f8; }';
    html += '.id-card { width: 320px; height: 480px; background: #fff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); overflow: hidden; position: relative; display: flex; flex-direction: column; border: 1px solid #e2e8f0; }';
    html += '.id-header { background: #0d1b2a; color: #fff; padding: 20px; text-align: center; border-bottom: 4px solid #f0a500; }';
    html += '.school-name { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; letter-spacing: 1px; }';
    html += '.school-motto { font-size: 10px; color: #cbd5e1; margin-top: 4px; font-style: italic; }';
    html += '.id-body { padding: 20px; text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; }';
    html += '.student-photo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); margin-top: -40px; background: #f0f0f0; }';
    html += '.student-name { font-size: 20px; font-weight: 800; color: #1e293b; margin: 15px 0 5px; text-transform: uppercase; }';
    html += '.student-class { font-size: 14px; font-weight: 600; color: #f0a500; margin-bottom: 20px; padding: 4px 12px; background: #fff8eb; border-radius: 20px; border: 1px solid #ffe8c2; }';
    html += '.info-grid { width: 100%; text-align: left; margin-top: 10px; }';
    html += '.info-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px dashed #e2e8f0; }';
    html += '.info-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }';
    html += '.info-value { font-size: 13px; color: #0f172a; font-weight: 600; }';
    html += '.id-footer { background: #f8fafc; padding: 12px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; }';
    html += '</style></head><body>';
    html += '<div class="id-card">';
    
    html += '<div class="id-header">';
    html += '<div class="school-name">' + (cfg.schoolName || 'MySchool Portal') + '</div>';
    if(cfg.schoolMotto) html += '<div class="school-motto">' + cfg.schoolMotto + '</div>';
    html += '</div>';
    
    html += '<div class="id-body">';
    html += '<img src="https://ui-avatars.com/api/?name=' + encodeURIComponent(student.fullName || 'S') + '&background=0d1b2a&color=fff&size=120" class="student-photo" alt="Photo">';
    html += '<div class="student-name">' + (student.fullName || 'N/A') + '</div>';
    html += '<div class="student-class">' + (student.className || 'N/A') + '</div>';
    
    html += '<div class="info-grid">';
    html += '<div class="info-row"><span class="info-label">Admission No</span><span class="info-value">' + (student.admissionNumber || 'N/A') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">Gender</span><span class="info-value">' + (student.gender || 'N/A') + '</span></div>';
    html += '<div class="info-row"><span class="info-label">DOB</span><span class="info-value">' + (student.dob || 'N/A') + '</span></div>';
    html += '</div>';
    
    html += '</div>';
    
    html += '<div class="id-footer">If found, please return to the school authority.</div>';
    html += '</div></body></html>';
    
    return html;
  }
};
