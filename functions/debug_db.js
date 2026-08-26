const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const p = await db.collection("payments").get();
  console.log("PAYMENTS:");
  p.forEach(d => console.log(d.id, d.data()));
  
  const b = await db.collection("bills").get();
  console.log("BILLS:");
  b.forEach(d => console.log(d.id, d.data()));
}
run();
