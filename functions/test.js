const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStoreItems() {
  const snap = await db.collection("store_items").get();
  console.log("Total items:", snap.size);
  snap.docs.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

checkStoreItems().catch(console.error);
