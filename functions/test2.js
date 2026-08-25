const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "cloudschool-3c1d4"
});
const db = admin.firestore();
async function run() {
  const docs = await db.collection('store_items').get();
  docs.forEach(d => console.log(d.id, d.data()));
}
run();
