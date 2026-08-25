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
    html += '.sig-line{border-top:1px solid #333;margin-top:2px;padding-top:2px;font-size:9px;}';
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
    let isHalfTerm = report.reportType && report.reportType.toLowerCase().includes('half');
    let titleTerm = isHalfTerm ? term + ' Half-Term' : term;
    html += '<div class="rpt-title">' + titleTerm + ' Report - ' + session + '</div>';
    html += '</div>';
    
    let photoUrl = s.photoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(s.fullName || 'S') + '&background=f0a500&color=fff&size=300');
    html += '<img src="' + photoUrl + '" style="width:70px; height:85px; object-fit:cover; margin-right:0; margin-left:15px; border:1px solid #ccc; border-radius:4px;" alt="Photo">';
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
    if (!isHalfTerm) {
      html += '<div class="sum-box"><div class="sum-val">' + (summary.average || 0) + '%</div><div class="sum-lbl">Average</div></div>';
      html += '<div class="sum-box"><div class="sum-val">' + (summary.overallGrade || 'N/A') + '</div><div class="sum-lbl">Overall Grade</div></div>';
    }
    html += '<div class="sum-box">';
    html += '<div class="sum-val">' + (att.percentage || 0) + '%</div><div class="sum-lbl">Attendance</div>';
    html += '<div style="font-size:8px;color:#444;margin-top:2px;font-weight:bold;">Pre: ' + (att.present || 0) + ' | Abs: ' + (att.absent || 0) + ' | Late: ' + (att.late || 0) + '</div>';
    html += '</div></div>';

    // Scores Table
    html += '<div class="sec-title">Academic Performance</div>';
    
    let format = (cfg && cfg.gradebook_format) ? cfg.gradebook_format : [
      { id: 'ca1', title: 'CA1', max: 10 },
      { id: 'ca2', title: 'CA2', max: 10 },
      { id: 'ca3', title: 'CA3', max: 10 },
      { id: 'exam', title: 'Exam', max: 70 }
    ];

    if (isHalfTerm) {
      let htFormat = format.slice(0, Math.min(2, format.length)); // First 2 columns for half term
      html += '<table><tr><th>S/N</th><th>Subject</th>';
      htFormat.forEach(col => { html += '<th>' + col.title + '</th>'; });
      html += '<th>Subj. Att.</th></tr>';
      
      for (let i = 0; i < scores.length; i++) {
        let sc = scores[i];
        html += '<tr><td>' + (i + 1) + '</td>';
        html += '<td style="text-align:left;padding-left:6px;">' + (sc.subjectName || '') + '</td>';
        htFormat.forEach(col => {
          let val = sc[col.id] !== undefined ? sc[col.id] : (sc[col.id.toUpperCase()] || 0);
          html += '<td>' + val + '</td>';
        });
        let subjAttHtml = (sc.subjectAttendancePercentage !== undefined && sc.subjectAttendancePercentage !== null) ? sc.subjectAttendancePercentage + '%' : '-';
        html += '<td>' + subjAttHtml + '</td></tr>';
      }
    } else {
      html += '<table><tr><th>S/N</th><th>Subject</th>';
      format.forEach(col => { html += '<th>' + col.title + '</th>'; });
      html += '<th>Total</th><th>Grade</th><th>Subj. Att.</th></tr>';
      
      for (let i = 0; i < scores.length; i++) {
        let sc = scores[i];
        let g = sc.termGrade || sc.grade || 'F9';
        let gcls = (g === 'A1') ? 'grade-a' : (g === 'B2' || g === 'B3') ? 'grade-b' : (g.startsWith('C')) ? 'grade-c' : 'grade-f';
        
        html += '<tr><td>' + (i + 1) + '</td>';
        html += '<td style="text-align:left;padding-left:6px;">' + (sc.subjectName || '') + '</td>';
        
        format.forEach(col => {
          let val = sc[col.id] !== undefined ? sc[col.id] : (sc[col.id.toUpperCase()] || 0);
          html += '<td>' + val + '</td>';
        });
        
        html += '<td><strong>' + (sc.total || sc.termTotal || 0) + '</strong></td>';
        html += '<td class="' + gcls + '">' + g + '</td>';
        let subjAttHtml = (sc.subjectAttendancePercentage !== undefined && sc.subjectAttendancePercentage !== null) ? sc.subjectAttendancePercentage + '%' : '-';
        html += '<td>' + subjAttHtml + '</td></tr>';
      }
    }
    html += '</table>';

    html += '<div class="sec-title">Psychomotor & Affective Skills</div>';
    html += '<div style="display:flex; gap:10px;">';
    // Psychomotor
    html += '<div style="flex:1;"><table><tr><th>Psychomotor Skill</th><th>Rating</th></tr>';
    html += '<tr><td>Handwriting</td><td>' + (psy.handwriting || '-') + '</td></tr>';
    html += '<tr><td>Sport Skills</td><td>' + (psy.sportSkills || '-') + '</td></tr>';
    html += '<tr><td>Drawing</td><td>' + (psy.drawing || '-') + '</td></tr>';
    html += '<tr><td>Creativity</td><td>' + (psy.creativity || '-') + '</td></tr>';
    html += '<tr><td>Speaking</td><td>' + (psy.speaking || '-') + '</td></tr>';
    html += '<tr><td>Attentiveness</td><td>' + (psy.attentiveness || '-') + '</td></tr>';
    html += '</table></div>';
    // Affective
    html += '<div style="flex:1;"><table><tr><th>Affective Trait</th><th>Rating</th></tr>';
    html += '<tr><td>Punctuality</td><td>' + (aff.punctuality || '-') + '</td></tr>';
    html += '<tr><td>Neatness</td><td>' + (aff.neatness || '-') + '</td></tr>';
    html += '<tr><td>Politeness</td><td>' + (aff.politeness || '-') + '</td></tr>';
    html += '<tr><td>Honesty</td><td>' + (aff.honesty || '-') + '</td></tr>';
    html += '<tr><td>Leadership</td><td>' + (aff.leadership || '-') + '</td></tr>';
    html += '<tr><td>Cooperation</td><td>' + (aff.cooperation || '-') + '</td></tr>';
    html += '</table></div>';
    html += '</div>';

    let sec = (s.section || '').toLowerCase();
    let isPrimary = (sec === 'primary' || sec === 'primary school' || sec === 'preprimary' || sec === 'nursery');

    html += '<div class="comment-box"><strong>Class Teacher\'s Comment:</strong> <span style="color:#555;font-style:italic;">' + (report.classTeacherComment || '') + '</span></div>';
    if (isPrimary) {
      html += '<div class="comment-box"><strong>Head Teacher\'s Comment:</strong> <span style="color:#555;font-style:italic;">' + (report.headTeacherComment || '') + '</span></div>';
    } else {
      html += '<div class="comment-box"><strong>Principal\'s Comment:</strong> <span style="color:#555;font-style:italic;">' + (report.principalComment || '') + '</span></div>';
    }

    if (term && term.toLowerCase() === 'third term' && s.promotionStatus && s.promotionSession === session) {
      html += '<div class="comment-box" style="margin-top:15px; border-color:#2a75d3; background-color:#eef5fc;"><strong>Promotion Status:</strong> <span style="color:#0f172a; font-weight:bold; font-size:15px; text-transform:uppercase;">' + s.promotionStatus + '</span></div>';
    }

    html += '<div class="sig-row">';
    
    let ctSig = cfg.class_teacher_signature ? '<img src="' + cfg.class_teacher_signature + '" style="max-height:30px; object-fit:contain; display:block; margin: 0 auto;">' : '<div style="height:30px;"></div>';
    html += '<div class="sig-box">' + ctSig + '<div class="sig-line">Class Teacher\'s Signature</div></div>';

    if (isPrimary) {
      let htSig = cfg.head_teacher_signature ? '<img src="' + cfg.head_teacher_signature + '" style="max-height:30px; object-fit:contain; display:block; margin: 0 auto;">' : '<div style="height:30px;"></div>';
      html += '<div class="sig-box">' + htSig + '<div class="sig-line">Head Teacher\'s Signature</div></div>';
    } else {
      let prinSig = cfg.principal_signature ? '<img src="' + cfg.principal_signature + '" style="max-height:30px; object-fit:contain; display:block; margin: 0 auto;">' : '<div style="height:30px;"></div>';
      html += '<div class="sig-box">' + prinSig + '<div class="sig-line">Principal\'s Signature</div></div>';
    }

    html += '</div>';

    html += '<div class="footer">Generated by MySchool Portal Cloud Engine</div>';
    html += '</div></body></html>';
    return html;
  },

  generateStudentIdCardHTML: function(student, cfg) {
    let schoolName = cfg.school_name || 'MY SCHOOL CLOUD';
    let motto = cfg.school_motto || 'In Love, Serve One Another';
    let termSess = (student.session || '2025/2026');
    let sectionName = (student.section === 'primary') ? 'Primary School' : 'High School';
    
    let photoUrl = student.photoUrl || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(student.fullName || 'S') + '&background=f0a500&color=fff&size=300');
    let logoUrl = cfg.school_logo_url || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(schoolName) + '&background=0d1b2a&color=fff');

    // Build repeating watermark text for the front
    let wmText = '';
    for(let i = 0; i < 30; i++) { wmText += '<div class="watermark-text">' + schoolName + '</div>'; }

    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ID Card</title><style>';
    html += '@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap");';
    html += 'body { font-family: "Outfit", sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #e2e8f0; gap: 30px; padding: 20px; }';
    html += '.card { width: 520px; height: 320px; background: #ffffff; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.05); position: relative; overflow: hidden; display: flex; flex-direction: row; box-sizing: border-box; }';
    html += '.card::before { content: ""; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 75% 25%, rgba(240, 165, 0, 0.08) 0%, transparent 40%), radial-gradient(circle at 10% 90%, rgba(13, 27, 42, 0.04) 0%, transparent 40%); z-index: 0; pointer-events: none; }';
    
    // Front Watermarks
    html += '.watermark-front { position: absolute; top: 0; left: -100px; width: 800px; height: 400px; display: flex; flex-wrap: wrap; transform: rotate(-25deg); opacity: 0.04; pointer-events: none; z-index: 1; align-content: center; justify-content: center; }';
    html += '.watermark-text { font-size: 18px; font-weight: 800; color: #0f172a; margin: 10px 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 2px; }';

    
    // LEFT SIDE - PHOTO PROFILE
    html += '.photo-pane { width: 38%; height: 100%; position: relative; z-index: 2; padding: 25px 20px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border-right: 1px solid rgba(0,0,0,0.05); }';
    html += '.student-photo { width: 135px; height: 155px; border-radius: 14px; object-fit: cover; box-shadow: 0 12px 24px rgba(0,0,0,0.12); border: 4px solid #ffffff; background: #e2e8f0; }';
    html += '.badge { margin-top: 20px; background: rgba(240, 165, 0, 0.15); color: #c27d00; font-size: 11px; font-weight: 800; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; text-align: center; width: max-content; }';

    // RIGHT SIDE - CONTENT
    html += '.content-pane { width: 62%; height: 100%; position: relative; z-index: 2; padding: 25px 30px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }';
    html += '.header { display: flex; align-items: center; gap: 12px; }';
    html += '.logo-img { width: 45px; height: 45px; border-radius: 10px; object-fit: contain; background: #fff; padding: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }';
    html += '.school-info { display: flex; flex-direction: column; justify-content: center; }';
    html += '.school-name { font-size: 15px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; line-height: 1.2; }';
    html += '.school-motto { font-size: 10px; color: #64748b; font-weight: 500; font-style: italic; margin-top: 3px; }';
    
    html += '.identity-section { margin-top: auto; margin-bottom: auto; }';
    html += '.card-title { font-size: 9px; font-weight: 800; color: #f0a500; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }';
    html += '.student-name { font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; line-height: 1.1; margin-bottom: 15px; letter-spacing: -0.5px; }';
    
    html += '.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 15px; }';
    html += '.info-item { display: flex; flex-direction: column; gap: 3px; }';
    html += '.info-label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }';
    html += '.info-value { font-size: 13px; font-weight: 600; color: #334155; }';
    
    html += '.footer { display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.06); margin-top: auto; }';
    html += '.footer-text { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }';
    html += '.accent-line { position: absolute; left: 0; bottom: 0; width: 100%; height: 5px; background: linear-gradient(90deg, #f0a500, #ffc947); }';
    
    // BACK SIDE
    html += '.card.back { flex-direction: column; padding: 30px; justify-content: center; }';
    html += '.back-header { text-align: center; font-size: 16px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 1.5px; z-index: 2; margin-bottom: 25px; }';
    html += '.terms-title { font-size: 11px; font-weight: 800; color: #f0a500; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; z-index: 2; }';
    html += '.terms-list { margin: 0; padding-left: 15px; z-index: 2; font-size: 12px; color: #475569; font-weight: 500; line-height: 1.6; }';
    html += '.terms-list li { margin-bottom: 6px; }';
    html += '.terms-list li::marker { color: #f0a500; font-size: 14px; }';
    html += '.barcode-wrapper { text-align: center; margin-top: auto; z-index: 2; }';
    html += '.barcode { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: 3px; font-family: monospace; }';
    html += '.barcode-bars { margin: 8px auto 0; width: 220px; height: 30px; background-image: repeating-linear-gradient(90deg, #0f172a, #0f172a 2px, transparent 2px, transparent 5px, #0f172a 5px, #0f172a 9px, transparent 9px, transparent 12px); opacity: 0.85; }';
    html += '.watermark-back { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; z-index: 1; width: 240px; height: 240px; object-fit: contain; }';
    
    html += '</style></head><body>';
    
    // ====== FRONT CARD ======
    html += '<div class="card front">';
    html += '<div class="watermark-front">' + wmText + '</div>';
    
    html += '<div class="photo-pane">';
    html += '<img src="' + photoUrl + '" class="student-photo" alt="Photo">';
    html += '<div class="badge">' + sectionName + '</div>';
    html += '</div>'; // end photo-pane
    
    html += '<div class="content-pane">';
    
    html += '<div class="header">';
    html += '<img src="' + logoUrl + '" class="logo-img" alt="Logo">';
    html += '<div class="school-info">';
    html += '<div class="school-name">' + schoolName + '</div>';
    html += '<div class="school-motto">' + motto + '</div>';
    html += '</div>'; // end school-info
    html += '</div>'; // end header
    
    html += '<div class="identity-section">';
    html += '<div class="card-title">Student Identity Card</div>';
    html += '<div class="student-name">' + (student.fullName || 'N/A') + '</div>';
    
    html += '<div class="info-grid" style="grid-template-columns: 1fr; gap: 8px;">';
    html += '<div class="info-item"><span class="info-label">Admission No</span><span class="info-value">' + (student.admissionNumber || 'N/A') + '</span></div>';
    html += '<div class="info-item"><span class="info-label">Class</span><span class="info-value">' + (student.className || 'N/A') + '</span></div>';
    html += '<div class="info-item"><span class="info-label">Gender</span><span class="info-value">' + (student.gender || 'N/A') + '</span></div>';
    html += '</div>'; // end info-grid
    html += '</div>'; // end identity-section
    
    html += '<div class="footer">';
    html += '<div class="footer-text">Valid: ' + termSess + '</div>';
    html += '<div class="footer-text">Academic Session</div>';
    html += '</div>'; // end footer
    
    html += '<div class="accent-line"></div>';
    html += '</div>'; // end content-pane
    html += '</div>'; // end front card

    // ====== BACK CARD ======
    html += '<div class="card back">';
    html += '<img src="' + logoUrl + '" class="watermark-back" alt="Watermark">';
    html += '<div class="back-header">' + schoolName + '</div>';
    
    html += '<div class="terms-title">Terms & Conditions</div>';
    html += '<ul class="terms-list">';
    html += '<li>This card must be worn at all times within the school premises.</li>';
    html += '<li>This card is non-transferable and must not be defaced.</li>';
    html += '<li>Loss of card must be reported to the school office immediately.</li>';
    html += '<li>If found, please return to the school office.</li>';
    html += '</ul>';
    
    html += '<div class="barcode-wrapper">';
    html += '<div class="barcode">' + (student.admissionNumber || 'N/A') + '</div>';
    html += '<div class="barcode-bars"></div>';
    html += '</div>'; // end barcode-wrapper
    
    html += '<div class="accent-line"></div>';
    html += '</div>'; // end back card

    html += '</body></html>';
    
    return html;
  }
};
