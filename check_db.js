const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

(async () => {
  try {
    const snap = await db.collection("students")
      .where("admissionNumber", "==", "MSC/26/0005")
      .get();
    
    if (snap.empty) {
      console.log("Student not found.");
    } else {
      const student = snap.docs[0].data();
      console.log("Student Found:", student.admissionNumber);
      console.log("Portal Enabled:", student.portalEnabled);
      console.log("Password Hash:", student.portalPasswordHash ? "Exists" : "MISSING!");
    }
  } catch (err) {
    console.error(err);
  }
})();
