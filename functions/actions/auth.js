const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// --- UTILITY: Hash Password ---
function hashPassword(password, salt) {
  const hash = crypto.createHash("sha256");
  hash.update((salt || "") + String(password));
  return hash.digest("hex");
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = function(db) {
  return {
    loginUser: async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.json({ success: false, message: "Email and password required." });
      
      const usersSnapshot = await db.collection("users").where("email", "==", email.trim().toLowerCase()).get();
      if (usersSnapshot.empty) return res.json({ success: false, message: "Invalid email or password." });
      
      const userDoc = usersSnapshot.docs[0];
      const user = userDoc.data();
      
      if (hashPassword(password, user.salt || "") !== user.passwordHash) {
        return res.json({ success: false, message: "Invalid email or password." });
      }
      
      if (String(user.status).toLowerCase() !== "active") {
        return res.json({ success: false, message: "Account suspended." });
      }
      
      const token = uuidv4();
      await db.collection("sessions").doc(token).set({
        userId: userDoc.id,
        role: user.role,
        fullName: user.fullName,
        section: user.section || "both",
        createdAt: new Date().toISOString()
      });
      
      await db.collection("audit_logs").add({
        timestamp: new Date().toISOString(),
        userId: userDoc.id,
        action: "LOGIN",
        details: `${user.fullName} logged in as ${user.role}`
      });
      
      return res.json({
        success: true,
        token: token,
        role: user.role,
        userName: user.fullName,
        userId: userDoc.id,
        section: user.section
      });
    },

    getCurrentUser: async (req, res) => {
      const sessionToken = req.body.token;
      if (!sessionToken) return res.json({ success: false, message: "Not authenticated" });
      
      const sessDoc = await db.collection("sessions").doc(sessionToken).get();
      if (!sessDoc.exists) return res.json({ success: false, message: "Invalid session" });
      
      const sess = sessDoc.data();
      const uDoc = await db.collection("users").doc(sess.userId).get();
      
      const settingsDoc = await db.collection("settings").doc("global").get();
      const settings = settingsDoc.exists ? settingsDoc.data() : { currentTerm: "1", currentSession: "2026/2027" };
      
      return res.json({
        success: true,
        user: { id: uDoc.id, ...uDoc.data() },
        role: sess.role,
        settings: settings
      });
    },

    logoutUser: async (req, res) => {
      const token = req.body.token;
      if (token) {
        try {
          await db.collection("sessions").doc(token).delete();
        } catch (e) {
          console.error("Logout error:", e);
        }
      }
      return res.json({ success: true, message: "Logged out successfully." });
    },

    userUpdateProfile: async (req, res) => {
      // Middleware attaches session to req.session
      if (!req.session) return res.status(401).json({ success: false, message: "Unauthorized" });
      
      const updates = req.body.data;
      if (!updates || Object.keys(updates).length === 0) {
        return res.json({ success: false, message: "No data provided" });
      }

      try {
        const allowedFields = ["phone", "address", "gender"]; // Only allow certain fields to be updated by user
        let safeUpdates = {};
        for (let key in updates) {
          if (allowedFields.includes(key)) {
            safeUpdates[key] = updates[key];
          }
        }

        if (Object.keys(safeUpdates).length > 0) {
          await db.collection("users").doc(req.session.userId).update(safeUpdates);
        }
        
        return res.json({ success: true, message: "Profile updated successfully." });
      } catch (err) {
        return res.json({ success: false, message: "Error updating profile: " + err.message });
      }
    },

    userChangePassword: async (req, res) => {
      if (!req.session) return res.status(401).json({ success: false, message: "Unauthorized" });
      
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.json({ success: false, message: "Current and new password required." });
      }

      try {
        const userRef = db.collection("users").doc(req.session.userId);
        const userDoc = await userRef.get();
        const user = userDoc.data();

        if (hashPassword(currentPassword, user.salt || "") !== user.passwordHash) {
          return res.json({ success: false, message: "Incorrect current password." });
        }

        const newSalt = generateSalt();
        const newHash = hashPassword(newPassword, newSalt);

        await userRef.update({
          salt: newSalt,
          passwordHash: newHash
        });

        // Terminate all sessions
        const sessionsSnapshot = await db.collection("sessions").where("userId", "==", req.session.userId).get();
        const batch = db.batch();
        sessionsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        return res.json({ success: true, message: "Password updated successfully. Please log in again." });
      } catch (err) {
        return res.json({ success: false, message: "Error changing password: " + err.message });
      }
    }
  };
};
