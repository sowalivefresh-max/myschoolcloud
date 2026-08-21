const admin = require("firebase-admin");

// Note: To run this script, you must have your serviceAccountKey.json in the functions folder
// and run it from the functions folder using `node ../scripts/sync_clearance.js`
try {
  const serviceAccount = require("../functions/serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("Could not load serviceAccountKey.json. Make sure it exists in the functions folder.");
  process.exit(1);
}

const db = admin.firestore();

async function syncAllStudents() {
  console.log("Fetching all students...");
  const studentsSnap = await db.collection("students").get();
  const studentIds = [];
  studentsSnap.forEach(doc => studentIds.push(doc.id));
  
  console.log(`Found ${studentIds.length} students. Starting sync...`);
  
  let updated = 0;
  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i];
    
    // 1. Get bills
    const bills1 = await db.collection("bills").where("studentId", "==", studentId).get();
    const bills2 = await db.collection("bills").where("studentID", "==", studentId).get();
    
    let totalBilled = 0;
    const seenDocs = new Set();
    const processBill = (doc) => {
      if (seenDocs.has(doc.id)) return;
      seenDocs.add(doc.id);
      let b = doc.data();
      totalBilled += Number(b.totalBilled || 0) + Number(b.arrears || 0);
    };
    bills1.forEach(processBill);
    bills2.forEach(processBill);

    // 2. Get payments
    const pays1 = await db.collection("payments").where("studentId", "==", studentId).where("status", "==", "Approved").get();
    const pays2 = await db.collection("payments").where("studentID", "==", studentId).where("status", "==", "Approved").get();
    
    let totalPaid = 0;
    const processPay = (doc) => {
      if (seenDocs.has(doc.id)) return;
      seenDocs.add(doc.id);
      totalPaid += Number(doc.data().amount || 0);
    };
    pays1.forEach(processPay);
    pays2.forEach(processPay);

    const isFinanciallyCleared = (totalBilled > 0 && totalPaid >= totalBilled);
    
    await db.collection("students").doc(studentId).update({ isFinanciallyCleared });
    updated++;
    
    if (updated % 50 === 0) {
      console.log(`Synced ${updated}/${studentIds.length} students...`);
    }
  }
  
  console.log(`Done! Successfully synced ${updated} students.`);
  process.exit(0);
}

syncAllStudents().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
