// reportUtil.js
const classTeacherBanks = {
  excellent: [
    "An outstanding performance! Keep up the excellent work.",
    "A brilliant result. You have shown great dedication.",
    "Exceptional effort and fantastic results. I am proud of you."
  ],
  veryGood: [
    "A very good result. Keep aiming higher.",
    "Great work this term. Continue to push yourself.",
    "Impressive performance. Consistent effort will yield even better results."
  ],
  good: [
    "Good result, but you have the potential to do much better.",
    "A solid effort, but more focus is needed to reach the top.",
    "You have done well, but there is room for improvement next term."
  ],
  fair: [
    "Fair result. More effort and dedication are needed.",
    "An average performance. You need to work harder in your studies.",
    "You passed, but you need to sit up and take your studies seriously."
  ],
  poor: [
    "Poor performance. You must pay more attention in class.",
    "A weak result. Serious improvement is needed next term.",
    "Disappointing performance. You need to focus much more on your academics."
  ]
};

const principalBanks = {
  excellent: [
    "An excellent term's work. The school is proud of you.",
    "Outstanding achievement. Maintain this high standard.",
    "A stellar performance. Keep the flag flying high."
  ],
  veryGood: [
    "Very good result. Keep up the good work and stay focused.",
    "Commendable performance. I encourage you to do even better.",
    "A highly satisfactory result. Continue to aim for the stars."
  ],
  good: [
    "Good effort. With a little more push, you can be among the best.",
    "A satisfactory performance. Strive for excellence next term.",
    "You have done fairly well, but do not rest on your oars."
  ],
  fair: [
    "You need to buckle down and improve on your weak areas.",
    "A marginal performance. I expect a much better result next term.",
    "More dedication to your studies is required for better grades."
  ],
  poor: [
    "This result is unacceptable. You need to wake up to your responsibilities.",
    "Very poor performance. You are advised to take your academics seriously.",
    "A dismal performance. I strongly advise you to work harder."
  ]
};

const getCommentFromBank = (avg, banks, hash) => {
  let category = 'poor';
  if (avg >= 85) category = 'excellent';
  else if (avg >= 70) category = 'veryGood';
  else if (avg >= 60) category = 'good';
  else if (avg >= 50) category = 'fair';
  
  const options = banks[category];
  return options[hash % options.length];
};

async function enrichReportData(dbInstance, reportData, cfg) {
  try {
    let student = reportData.student || {};
    let avg = reportData.summary && reportData.summary.average ? parseFloat(reportData.summary.average) : 0;
    
    // Create a simple deterministic hash based on student info
    const hashStr = (student.fullName || "Student") + (reportData.term || "") + (reportData.session || "");
    let hash = 0;
    for (let i = 0; i < hashStr.length; i++) hash += hashStr.charCodeAt(i);
    
    // Auto-generate comments
    reportData.classTeacherComment = getCommentFromBank(avg, classTeacherBanks, hash);
    reportData.principalComment = getCommentFromBank(avg, principalBanks, hash);
    reportData.headTeacherComment = reportData.principalComment; // Head teacher uses the same bank as principal

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
