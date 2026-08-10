const { db } = require("../firebase");

const getAutoComment = (avg) => {
  if (avg >= 85) return "Excellent performance. Keep it up.";
  if (avg >= 70) return "Very good result. Keep aiming higher.";
  if (avg >= 60) return "Good result. You can do better.";
  if (avg >= 50) return "Fair result. More effort is needed.";
  return "Poor performance. Needs serious improvement.";
};

async function enrichReportData(dbInstance, reportData, cfg) {
  try {
    let student = reportData.student || {};
    let avg = reportData.summary && reportData.summary.average ? parseFloat(reportData.summary.average) : 0;
    
    // Auto-generate comments
    reportData.classTeacherComment = getAutoComment(avg);
    reportData.principalComment = getAutoComment(avg);
    reportData.headTeacherComment = getAutoComment(avg);

    // Fetch class teacher signature
    if (student.className) {
      const classSnap = await dbInstance.collection("classes").where("className", "==", student.className).limit(1).get();
      if (!classSnap.empty) {
        let classData = classSnap.docs[0].data();
        if (classData.classTeacherId) {
          const ctSnap = await dbInstance.collection("users").doc(classData.classTeacherId).get();
          if (ctSnap.exists && ctSnap.data().signature) {
            cfg.class_teacher_signature = ctSnap.data().signature;
          }
        }
      }
    }

    // Fetch principal or headteacher signature based on section
    let sec = (student.section || '').toLowerCase();
    let isPrimary = (sec === 'primary' || sec === 'primary school' || sec === 'preprimary' || sec === 'nursery');
    let roleTarget = isPrimary ? "headteacher" : "principal";

    const pSnap = await dbInstance.collection("users").where("role", "==", roleTarget).limit(1).get();
    if (!pSnap.empty && pSnap.docs[0].data().signature) {
      if (isPrimary) {
        cfg.head_teacher_signature = pSnap.docs[0].data().signature;
      } else {
        cfg.principal_signature = pSnap.docs[0].data().signature;
      }
    }
  } catch (err) {
    console.error("Error enriching report data:", err);
  }
}

module.exports = { enrichReportData };
