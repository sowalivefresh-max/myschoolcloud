const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin
admin.initializeApp();
const db = getFirestore();

// Initialize Express App
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Import action handlers
const notificationsActions = require("./actions/notifications")(db);
const authActions = require("./actions/auth")(db);
const adminActions = require("./actions/admin")(db, notificationsActions);
const teacherActions = require("./actions/teacher")(db, notificationsActions);
const parentActions = require("./actions/parent")(db);

// --- UTILITY: Role Middleware ---
async function requireRole(req, res, next) {
  const token = req.body.token;
  if (!token) return res.status(401).json({ success: false, message: "No token provided." });

  try {
    const sessionRef = db.collection("sessions").doc(token);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
      return res.status(401).json({ success: false, message: "Invalid or expired session. Please log in again." });
    }

    const session = sessionDoc.data();
    const created = new Date(session.createdAt);
    const hoursElapsed = (new Date() - created) / (1000 * 60 * 60);
    
    if (hoursElapsed > 8) {
      await sessionRef.delete();
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    req.session = session;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ success: false, message: "Authentication error." });
  }
}

// ============================================================
// API ROUTES
// ============================================================

app.post("/api", async (req, res) => {
  const action = req.body.action;
  if (!action) return res.status(400).json({ success: false, message: "No action specified." });

  // --- GAS Compatibility Shim ---
  // The frontend sends { action: "...", args: [...] }
  // We unpack args so our Express routes can read from req.body directly
  if (req.body.args && Array.isArray(req.body.args)) {
    const args = req.body.args;
    if (args.length > 0) {
      if (typeof args[0] === 'object' && !Array.isArray(args[0])) {
        Object.assign(req.body, args[0]);
        req.body.data = args[0]; // For admin/teacher save routes
      } else {
        // Positional mappings for auth
        if (action === "loginUser") { req.body.email = args[0]; req.body.password = args[1]; }
        if (action === "requestPasswordReset") { req.body.email = args[0]; }
        if (action === "userChangePassword") { req.body.oldPassword = args[0]; req.body.newPassword = args[1]; }
        // For markNotificationRead
        if (action === "markNotificationRead") { req.body.notificationId = args[0]?.notificationId || args[0]; }
      }
    }
  }

  try {
    switch (action) {
      // --- AUTHENTICATION ACTIONS (No strict session required for all) ---
      case "loginUser": return authActions.loginUser(req, res);
      case "getCurrentUser": return authActions.getCurrentUser(req, res);
      case "logoutUser": return authActions.logoutUser(req, res);
      
      // The following require a valid session, so we can manually run requireRole, 
      // or we can just apply it inside the switch block.
      // For Express, since everything hits `/api`, we'll invoke the middleware explicitly.
      case "userUpdateProfile":
        return requireRole(req, res, () => authActions.userUpdateProfile(req, res));
      case "userChangePassword":
        return requireRole(req, res, () => authActions.userChangePassword(req, res));

      // --- ADMIN ACTIONS ---
      case "adminGetStats":
        return requireRole(req, res, () => adminActions.adminGetStats(req, res));
      case "adminGetUsers":
        return requireRole(req, res, () => adminActions.adminGetUsers(req, res));
      case "adminGetClasses":
        return requireRole(req, res, () => adminActions.adminGetClasses(req, res));
      case "adminGetSubjects":
        return requireRole(req, res, () => adminActions.adminGetSubjects(req, res));
      case "adminGetFeeStructures":
        return requireRole(req, res, () => adminActions.adminGetFeeStructures(req, res));
      case "adminSaveFeeStructure":
        return requireRole(req, res, () => adminActions.adminSaveFeeStructure(req, res));
      case "adminGenerateBills":
        return requireRole(req, res, () => adminActions.adminGenerateBills(req, res));

      // --- TEACHER ACTIONS ---
      case "teacherGetMySubjects":
        return requireRole(req, res, () => teacherActions.teacherGetMySubjects(req, res));
      case "teacherGetClassStudents":
        return requireRole(req, res, () => teacherActions.teacherGetClassStudents(req, res));
      case "teacherGetScores":
        return requireRole(req, res, () => teacherActions.teacherGetScores(req, res));
      case "teacherSaveScore":
        return requireRole(req, res, () => teacherActions.teacherSaveScore(req, res));
      case "teacherBulkSaveScores":
        return requireRole(req, res, () => teacherActions.teacherBulkSaveScores(req, res));
      case "teacherGetLessonPlans":
        return requireRole(req, res, () => teacherActions.teacherGetLessonPlans(req, res));
      case "teacherSaveLessonPlan":
        return requireRole(req, res, () => teacherActions.teacherSaveLessonPlan(req, res));
      case "teacherGetAttendance":
        return requireRole(req, res, () => teacherActions.teacherGetAttendance(req, res));
      case "teacherSaveAttendance":
        return requireRole(req, res, () => teacherActions.teacherSaveAttendance(req, res));
      case "teacherGetPsychomotor":
        return requireRole(req, res, () => teacherActions.teacherGetPsychomotor(req, res));
      case "teacherSavePsychomotor":
        return requireRole(req, res, () => teacherActions.teacherSavePsychomotor(req, res));
      case "teacherGetAffective":
        return requireRole(req, res, () => teacherActions.teacherGetAffective(req, res));
      case "teacherSaveAffective":
        return requireRole(req, res, () => teacherActions.teacherSaveAffective(req, res));

      // --- PARENT ACTIONS ---
      case "parentGetChildren":
        return requireRole(req, res, () => parentActions.parentGetChildren(req, res));
      case "parentGetReport":
        return requireRole(req, res, () => parentActions.parentGetReport(req, res));
      case "parentDownloadReport":
        return requireRole(req, res, () => parentActions.parentDownloadReport(req, res));
      case "parentGetBills":
        return requireRole(req, res, () => parentActions.parentGetBills(req, res));
      case "parentGetPayments":
        return requireRole(req, res, () => parentActions.parentGetPayments(req, res));

      // --- NOTIFICATIONS ACTIONS ---
      case "getNotifications":
        return requireRole(req, res, () => notificationsActions.getNotifications(req, res));
      case "markNotificationRead":
        return requireRole(req, res, () => notificationsActions.markNotificationRead(req, res));

      // Add more routes here as we build chunks...

      default:
        return res.status(404).json({ success: false, message: "Action not implemented yet in Cloud Functions API." });
    }
  } catch (error) {
    console.error(`Error processing action ${action}:`, error);
    return res.status(500).json({ success: false, message: `Server Error: ${error.message}` });
  }
});

exports.api = functions.https.onRequest(app);
