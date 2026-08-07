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
  const action = req.body.action;
  if (!token) return res.status(401).json({ success: false, message: "No token provided." });

  try {
    const sessionRef = db.collection("sessions").doc(token);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
      return res.status(401).json({ success: false, message: "Invalid or expired session. Please log in again." });
    }

    const session = sessionDoc.data();
    
    if (action) {
      const role = session.role;
      if (action.startsWith("admin")) {
        if (!["admin", "admin_assistant", "developer", "principal", "vp", "accounts", "headteacher"].includes(role)) {
          return res.status(403).json({ success: false, message: "Forbidden: Admin access required." });
        }
      } else if (action.startsWith("teacher")) {
        if (!["teacher", "primary_teacher", "headteacher", "admin", "developer", "principal", "vp"].includes(role)) {
          return res.status(403).json({ success: false, message: "Forbidden: Teacher access required." });
        }
      } else if (action.startsWith("parent")) {
        if (!["parent", "admin", "developer"].includes(role)) {
          return res.status(403).json({ success: false, message: "Forbidden: Parent access required." });
        }
      }
    }

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
  let action = req.body.action;
  if (!action) return res.status(400).json({ success: false, message: "No action specified." });

  // Map alternative dashboard prefixes to the core 'admin' API endpoints
  if (action.startsWith("principal") || action.startsWith("accounts") || action.startsWith("vp")) {
    const base = action.startsWith("vp") ? action.substring(2) : (action.startsWith("accounts") ? action.substring(8) : action.substring(9));
    action = "admin" + base;
    req.body.action = action; // update it so the rest of the file (including requireRole) sees 'admin...'
  }

  // --- GAS Compatibility Shim ---
  // The frontend sends { action: "...", args: [...] }
  // We unpack args so our Express routes can read from req.body directly
  if (req.body.args && Array.isArray(req.body.args)) {
    const args = req.body.args;
    if (args.length > 0) {
      if (typeof args[0] === 'object' && !Array.isArray(args[0])) {
        Object.assign(req.body, args[0]);
        req.body.data = args[0]; // For admin/teacher save routes
      } else if (typeof args[0] === 'string') {
        // First positional argument is almost always the token
        req.body.token = args[0];
        
        // Positional mappings for specific auth routes
        if (action === "loginUser") { req.body.email = args[0]; req.body.password = args[1]; }
        if (action === "requestPasswordReset") { req.body.email = args[0]; }
        if (action === "userChangePassword") { req.body.token = args[0]; req.body.oldPassword = args[1]; req.body.newPassword = args[2]; }
        if (action === "userUpdateProfile") { req.body.data = args[1]; }
        if (action === "markNotificationRead") { req.body.notificationId = args[0]; }
        
        // Positional mappings for other routes that pass more than just token
        if (action === "adminGetStats") { req.body.section = args[1]; }
        if (action === "adminGetClasses") { req.body.section = args[1]; }
        if (action === "adminGetAllStudents") { req.body.section = args[1]; }
        if (action === "adminGetUsers") { req.body.section = args[1]; }
        if (action === "adminGetComplianceSummary") { req.body.term = args[1]; req.body.session = args[2]; req.body.section = args[3]; }
        if (action === "adminGetLessonPlans") { req.body.term = args[1]; req.body.session = args[2]; req.body.section = args[3]; }
        if (action === "adminCreateUser") { req.body.data = args[1]; }
        if (action === "adminUpdateUser") { req.body.userId = args[1]; req.body.updates = args[2]; }
        if (action === "adminDeleteUser") { req.body.userId = args[1]; }
        
        if (action === "adminCreateStudent") { req.body.data = args[1]; }
        if (action === "adminUpdateStudent") { req.body.studentId = args[1]; req.body.updates = args[2]; }
        if (action === "adminDeleteStudent") { req.body.studentId = args[1]; }
        
        if (action === "adminCreateClass") { req.body.data = args[1]; }
        if (action === "adminUpdateClass") { req.body.classId = args[1]; req.body.updates = args[2]; }
        if (action === "adminDeleteClass") { req.body.classId = args[1]; }
        
        if (action === "adminCreateSubject") { req.body.data = args[1]; }
        if (action === "adminUpdateSubject") { req.body.subjectId = args[1]; req.body.updates = args[2]; }
        if (action === "adminDeleteSubject") { req.body.subjectId = args[1]; }

        if (action === "adminUpdateSettings") { req.body.data = args[1]; }
        if (action === "adminApprovePayment") { req.body.paymentId = args[1]; }
        if (action === "adminRejectPayment") { req.body.paymentId = args[1]; }
        if (action === "adminSaveFeeStructure") { req.body.data = args[1]; }
        if (action === "adminDeleteFeeStructure") { req.body.feeId = args[1]; }
        if (action === "adminGenerateBills") { req.body.term = args[1]; req.body.session = args[2]; req.body.classFilters = args[3]; }
        
        // Phase 2 Mappings
        if (action === "adminGetStudentSubjects") { req.body.studentId = args[1]; }
        if (action === "adminEnrollStudent") { req.body.studentId = args[1]; req.body.subjectId = args[2]; req.body.session = args[3]; req.body.term = args[4]; }
        if (action === "adminUnenrollStudent") { req.body.studentId = args[1]; req.body.subjectId = args[2]; req.body.session = args[3]; }
        if (action === "adminSaveGradeRule") { req.body.data = args[1]; }
        if (action === "adminGenerateBulkResult") { req.body.className = args[1]; req.body.term = args[2]; req.body.session = args[3]; req.body.rptType = args[4]; }

        // Phase 3 Mappings
        if (action === "adminResetUserPassword") { req.body.userId = args[1]; }
        if (action === "adminImpersonateUser") { req.body.userId = args[1]; }
        if (action === "adminGenerateIDCard") { req.body.studentId = args[1]; }
        if (action === "adminBulkCreateStudents") { req.body.students = args[1]; }
        if (action === "adminBulkCreateClasses") { req.body.classes = args[1]; }
        if (action === "adminSetStudentDiscount") { req.body.studentId = args[1]; req.body.discountConfig = args[2]; }
        if (action === "adminBulkCreateSubjects") { req.body.subjects = args[1]; }
        if (action === "adminApproveTask") { req.body.taskId = args[1]; }
        if (action === "adminRejectTask") { req.body.taskId = args[1]; req.body.note = args[2]; }
        if (action === "adminProcessPasswordReset") { req.body.requestId = args[1]; req.body.newPassword = args[2]; }
        if (action === "adminGetStudentResultPDF") { req.body.studentId = args[1]; req.body.term = args[2]; req.body.session = args[3]; req.body.rptType = args[4]; }
        if (action === "teacherGenerateLessonPlanPDF") { req.body.planId = args[1]; }
        
        // Additional Accounts Mappings
        if (action === "adminGetFinancialStats") { req.body.term = args[1]; req.body.session = args[2]; }
        if (action === "adminGetDebtors") { req.body.term = args[1]; req.body.session = args[2]; }
        if (action === "adminGetBroadsheetData") { req.body.className = args[1]; req.body.term = args[2]; req.body.session = args[3]; }
        if (action === "adminGetBills") { req.body.filters = args[1]; }
        if (action === "adminRecordPayment") { req.body.data = args[1]; }
        if (action === "adminGetStudentLedger") { req.body.studentId = args[1]; }
        if (action === "adminGetSchoolPerformance") { req.body.term = args[1]; req.body.session = args[2]; req.body.section = args[3]; }
        if (action === "adminGetSchoolPerformanceAnalytics") { req.body.term = args[1]; req.body.session = args[2]; req.body.section = args[3]; }
        if (action === "adminGetYearGroupRanking") { req.body.term = args[1]; req.body.session = args[2]; req.body.yearGroup = args[3]; }
        if (action === "adminGenerateReceipt") { req.body.paymentId = args[1]; }
        
        // Teacher Subject Assignment Mappings
        if (action === "teacherGetStudentSubjects") { req.body.studentId = args[1]; }
        if (action === "teacherEnrollStudent") { req.body.studentId = args[1]; req.body.subjectId = args[2]; req.body.session = args[3]; req.body.term = args[4]; }
        if (action === "teacherUnenrollStudent") { req.body.studentId = args[1]; req.body.subjectId = args[2]; }
        if (action === "adminRecordExpense") { req.body.data = args[1]; }
        if (action === "adminDeleteExpense") { req.body.expenseId = args[1]; }
        if (action === "adminDeleteBill") { req.body.billId = args[1]; }
        if (action === "adminSendReminders") { req.body.term = args[1]; req.body.session = args[2]; req.body.batchSize = args[3]; }
        if (action === "adminGetSubjects") { /* no args */ }
        
        if (action === "teacherGetMySubjects") { req.body.userId = args[1]; }
        if (action === "teacherGetClassStudents") { req.body.className = args[1]; }
        if (action === "teacherGetScores") { req.body.filters = args[1]; }
        if (action === "teacherSaveScore") { req.body.scoreId = args[1]; req.body.studentId = args[2]; req.body.className = args[3]; req.body.subject = args[4]; req.body.term = args[5]; req.body.session = args[6]; req.body.ca1 = args[7]; req.body.ca2 = args[8]; req.body.exam = args[9]; }
        if (action === "teacherBulkSaveScores") { req.body.data = args[1]; } // fixed mapping
        
        if (action === "teacherGetPsychomotor") { req.body.studentId = args[1]; req.body.term = args[2]; req.body.session = args[3]; }
        if (action === "teacherGetAffective") { req.body.studentId = args[1]; req.body.term = args[2]; req.body.session = args[3]; }
        if (action === "teacherSavePsychomotor") { req.body.data = args[1]; }
        if (action === "teacherSaveAffective") { req.body.data = args[1]; }

        // Legacy Teacher Dashboard Aliases
        if (action === "teacherGetMyLessonPlans") { /* no args mapped to req.body needed, uses session */ }
        if (action === "principalGetAllStudents") { /* no args needed for adminGetStudents */ }
        if (action === "teacherGetAttendanceByDate") { req.body.className = args[1]; req.body.date = args[2]; }
        if (action === "teacherMarkAttendance") { req.body.className = args[1]; req.body.date = args[2]; req.body.records = args[3]; req.body.term = args[4]; req.body.session = args[5]; }
        if (action === "teacherSubmitScores") { /* mock success, usually frontend expects {success:true} */ }
        if (action === "teacherSubmitLessonPlan") { req.body.planId = args[1]; req.body.status = "submitted"; }
        if (action === "teacherGetSubjectStudents") { req.body.subjectId = args[1]; }
        if (action === "adminGenerateBulkResult") { req.body.className = args[1]; req.body.term = args[2]; req.body.session = args[3]; req.body.reportType = args[4]; }
        if (action === "principalGetStudentResultPDF") { req.body.studentId = args[1]; req.body.term = args[2]; req.body.session = args[3]; req.body.reportType = args[4]; }

        // Parent Mappings
        if (action === "parentGenerateIDCard") { req.body.studentId = args[1]; }
        if (action === "parentDownloadReport") { req.body.studentId = args[1]; req.body.term = args[2]; req.body.session = args[3]; req.body.reportType = args[4]; }
        if (action === "parentGetStudentCredit") { req.body.studentId = args[1]; }
        if (action === "parentGetBills") { req.body.studentId = args[1]; }
        if (action === "parentGetPayments") { req.body.studentId = args[1]; }
        if (action === "parentSubmitPaymentData") { req.body.data = args[1]; }
        if (action === "parentDownloadReceipt") { req.body.paymentId = args[1]; }
        
        // Parent Invite Mappings
        if (action === "adminGenerateParentInvite") { req.body.linkedStudentId = args[1]; }
        if (action === "adminRevokeParentInvite") { req.body.token = args[1]; }
        if (action === "validateParentInvite") { req.body.token = args[0]; }
        if (action === "parentSelfRegister") { req.body.token = args[0]; req.body.fullName = args[1]; req.body.email = args[2]; req.body.password = args[3]; req.body.phone = args[4]; }
      }
    }
  }

  try {
    switch (action) {
      // --- AUTHENTICATION ACTIONS (No strict session required for all) ---
      case "getPublicBranding": return authActions.getPublicBranding(req, res);
      case "requestPasswordReset": return authActions.requestPasswordReset(req, res);
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
      case "adminCreateUser":
        return requireRole(req, res, () => adminActions.adminCreateUser(req, res));
      case "adminUpdateUser":
        return requireRole(req, res, () => adminActions.adminUpdateUser(req, res));
      case "adminDeleteUser":
        return requireRole(req, res, () => adminActions.adminDeleteUser(req, res));
      
      case "adminGetStudents":
        return requireRole(req, res, () => adminActions.adminGetStudents(req, res));
      case "adminCreateStudent":
        return requireRole(req, res, () => adminActions.adminCreateStudent(req, res));
      case "adminUpdateStudent":
        return requireRole(req, res, () => adminActions.adminUpdateStudent(req, res));
      case "adminDeleteStudent":
        return requireRole(req, res, () => adminActions.adminDeleteStudent(req, res));
      case "adminSetStudentDiscount":
        return requireRole(req, res, () => adminActions.adminSetStudentDiscount(req, res));
        
      case "adminGetSettings":
        return requireRole(req, res, () => adminActions.adminGetSettings(req, res));
      case "adminUpdateSettings":
        return requireRole(req, res, () => adminActions.adminUpdateSettings(req, res));

      case "adminGetClasses":
        return requireRole(req, res, () => adminActions.adminGetClasses(req, res));
      case "adminCreateClass":
        return requireRole(req, res, () => adminActions.adminCreateClass(req, res));
      case "adminUpdateClass":
        return requireRole(req, res, () => adminActions.adminUpdateClass(req, res));
      case "adminDeleteClass":
        return requireRole(req, res, () => adminActions.adminDeleteClass(req, res));

      case "adminGetSubjects":
        return requireRole(req, res, () => adminActions.adminGetSubjects(req, res));
      case "adminCreateSubject":
        return requireRole(req, res, () => adminActions.adminCreateSubject(req, res));
      case "adminUpdateSubject":
        return requireRole(req, res, () => adminActions.adminUpdateSubject(req, res));
      case "adminDeleteSubject":
        return requireRole(req, res, () => adminActions.adminDeleteSubject(req, res));

      // --- SECONDARY ADMIN ACTIONS ---
      case "adminGetAuditLogs": return requireRole(req, res, () => adminActions.adminGetAuditLogs(req, res));
      case "adminGetPasswordRequests": return requireRole(req, res, () => adminActions.adminGetPasswordRequests(req, res));
      case "adminGetPayments": return requireRole(req, res, () => adminActions.adminGetPayments(req, res));
      case "adminGetExpenses": return requireRole(req, res, () => adminActions.adminGetExpenses(req, res));
      case "adminGetPendingTasks": return requireRole(req, res, () => adminActions.adminGetPendingTasks(req, res));
      case "adminGetGrading": return requireRole(req, res, () => adminActions.adminGetGrading(req, res));
      case "adminGetStudentSubjects": return requireRole(req, res, () => adminActions.adminGetStudentSubjects(req, res));
      
      case "adminProcessPasswordReset": return requireRole(req, res, () => adminActions.adminProcessPasswordReset(req, res));
      case "adminResetUserPassword": return requireRole(req, res, () => adminActions.adminResetUserPassword(req, res));
      case "adminApprovePayment": return requireRole(req, res, () => adminActions.adminApprovePayment(req, res));
      case "adminRejectPayment": return requireRole(req, res, () => adminActions.adminRejectPayment(req, res));
      case "adminApproveTask": return requireRole(req, res, () => adminActions.adminApproveTask(req, res));
      case "adminRejectTask": return requireRole(req, res, () => adminActions.adminRejectTask(req, res));
      case "adminImpersonateUser": return requireRole(req, res, () => adminActions.adminImpersonateUser(req, res));
      case "adminGenerateIDCard": return requireRole(req, res, () => adminActions.adminGenerateIDCard(req, res));
      case "adminBulkCreateStudents": return requireRole(req, res, () => adminActions.adminBulkCreateStudents(req, res));
      case "adminBulkCreateClasses": return requireRole(req, res, () => adminActions.adminBulkCreateClasses(req, res));
      case "adminBulkCreateSubjects": return requireRole(req, res, () => adminActions.adminBulkCreateSubjects(req, res));
      case "adminEnrollStudent": return requireRole(req, res, () => adminActions.adminEnrollStudent(req, res));
      case "adminUnenrollStudent": return requireRole(req, res, () => adminActions.adminUnenrollStudent(req, res));
      case "adminSaveGradeRule": return requireRole(req, res, () => adminActions.adminSaveGradeRule(req, res));
      case "adminGenerateBulkResult": return requireRole(req, res, () => adminActions.adminGenerateBulkResult(req, res));
      case "adminGetBroadsheetData": return requireRole(req, res, () => adminActions.adminGetBroadsheetData(req, res));
      case "adminGetComplianceSummary": return requireRole(req, res, () => adminActions.adminGetComplianceSummary(req, res));
      case "adminGetSchoolPerformance":
      case "adminGetSchoolPerformanceAnalytics": return requireRole(req, res, () => adminActions.adminGetSchoolPerformanceAnalytics(req, res));
      case "adminGetYearGroupRanking": return requireRole(req, res, () => adminActions.adminGetYearGroupRanking(req, res));

      case "adminGetFeeStructures":
        return requireRole(req, res, () => adminActions.adminGetFeeStructures(req, res));
      case "adminSaveFeeStructure":
        return requireRole(req, res, () => adminActions.adminSaveFeeStructure(req, res));
      case "adminDeleteFeeStructure":
        return requireRole(req, res, () => adminActions.adminDeleteFeeStructure(req, res));
      case "adminGenerateBills":
        return requireRole(req, res, () => adminActions.adminGenerateBills(req, res));
      case "adminGetBills":
        return requireRole(req, res, () => adminActions.adminGetBills(req, res));
      case "adminDeleteBill":
        return requireRole(req, res, () => adminActions.adminDeleteBill(req, res));
      
      // New Accounts & Finance Endpoints
      case "adminGetFinancialStats":
        return requireRole(req, res, () => adminActions.adminGetFinancialStats(req, res));
      case "adminGetDebtors":
        return requireRole(req, res, () => adminActions.adminGetDebtors(req, res));
      case "adminRecordPayment":
        return requireRole(req, res, () => adminActions.adminRecordPayment(req, res));
      case "adminGetStudentLedger":
        return requireRole(req, res, () => adminActions.adminGetStudentLedger(req, res));
      case "adminGenerateReceipt":
        return requireRole(req, res, () => adminActions.adminGenerateReceipt(req, res));
      case "adminRecordExpense":
        return requireRole(req, res, () => adminActions.adminRecordExpense(req, res));
      case "adminDeleteExpense":
        return requireRole(req, res, () => adminActions.adminDeleteExpense(req, res));
      case "adminSendReminders":
        return requireRole(req, res, () => adminActions.adminSendReminders(req, res));
        
      // New Principal Endpoints
      case "adminGetLessonPlans":
        return requireRole(req, res, () => adminActions.adminGetLessonPlans(req, res));
      case "adminApprovePlan":
        return requireRole(req, res, () => adminActions.adminApprovePlan(req, res));
      case "adminRejectPlan":
        return requireRole(req, res, () => adminActions.adminRejectPlan(req, res));
      case "adminGetAllStudents":
        return requireRole(req, res, () => adminActions.adminGetStudents(req, res)); // Alias to existing
      case "adminGetStudentResultPDF":
        return requireRole(req, res, () => adminActions.adminGetStudentResultPDF(req, res));
      case "teacherGenerateLessonPlanPDF":
        // Allow teachers and principals
        return requireRole(req, res, () => teacherActions.teacherGenerateLessonPlanPDF(req, res));

      // --- TEACHER ACTIONS ---
      case "teacherGetMySubjects":
        return requireRole(req, res, () => teacherActions.teacherGetMySubjects(req, res));
      case "teacherGetClassStudents":
        return requireRole(req, res, () => teacherActions.teacherGetClassStudents(req, res));
      case "teacherGetScores":
        return requireRole(req, res, () => teacherActions.teacherGetScores(req, res));
      case "teacherSaveScore":
        return requireRole(req, res, () => teacherActions.teacherSaveScore(req, res));
      case "teacherUpdateTrait": return requireRole(req, res, () => teacherActions.teacherUpdateTrait(req, res));
      case "teacherGetStudentCount": return requireRole(req, res, () => teacherActions.teacherGetStudentCount(req, res));
      case "teacherGetStudentSubjects": return requireRole(req, res, () => teacherActions.teacherGetStudentSubjects(req, res));
      case "teacherEnrollStudent": return requireRole(req, res, () => teacherActions.teacherEnrollStudent(req, res));
      case "teacherUnenrollStudent": return requireRole(req, res, () => teacherActions.teacherUnenrollStudent(req, res));
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
      
      // Legacy Aliases for Teacher UI
      case "teacherGetMyLessonPlans":
        return requireRole(req, res, () => teacherActions.teacherGetLessonPlans(req, res));
      case "teacherSubmitLessonPlan":
        // Maps to save with submitted status
        return requireRole(req, res, () => teacherActions.teacherSaveLessonPlan(req, res));
      case "teacherGetAttendanceByDate":
        return requireRole(req, res, () => teacherActions.teacherGetAttendance(req, res));
      case "teacherMarkAttendance":
        return requireRole(req, res, () => teacherActions.teacherSaveAttendance(req, res));
      case "teacherSubmitScores":
        // Mock success for submit scores button
        return res.json({ success: true, message: "Scores submitted successfully." });
      case "teacherGetSubjectStudents":
        return requireRole(req, res, () => teacherActions.teacherGetSubjectStudents(req, res));
      case "principalGetAllStudents":
        return requireRole(req, res, () => adminActions.adminGetStudents(req, res));
      case "adminGenerateBulkResult":
        return requireRole(req, res, () => adminActions.adminGenerateBulkResult(req, res));
      case "principalGetStudentResultPDF":
        // Mapped to parentDownloadReport logic internally but called by principal/teacher
        return requireRole(req, res, () => parentActions.parentDownloadReport(req, res));


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
      case "parentGenerateIDCard":
        return requireRole(req, res, () => parentActions.parentGenerateIDCard(req, res));
      case "parentGetStudentCredit":
        return requireRole(req, res, () => parentActions.parentGetStudentCredit(req, res));
      case "parentSubmitPaymentData":
        return requireRole(req, res, () => parentActions.parentSubmitPaymentData(req, res));
      case "parentDownloadReceipt":
        return requireRole(req, res, () => parentActions.parentDownloadReceipt(req, res));

      // --- NOTIFICATIONS ACTIONS ---
      case "getNotifications":
        return requireRole(req, res, () => notificationsActions.getNotifications(req, res));
      case "markNotificationRead":
        return requireRole(req, res, () => notificationsActions.markNotificationRead(req, res));

      // --- PARENT INVITE ACTIONS ---
      case "adminGenerateParentInvite":
        return requireRole(req, res, () => adminActions.adminGenerateParentInvite(req, res));
      case "adminGetParentInvites":
        return requireRole(req, res, () => adminActions.adminGetParentInvites(req, res));
      case "adminRevokeParentInvite":
        return requireRole(req, res, () => adminActions.adminRevokeParentInvite(req, res));
      
      // Public (no session required) — parent self-registration
      case "validateParentInvite":
        return authActions.validateParentInvite(req, res);
      case "parentSelfRegister":
        return authActions.parentSelfRegister(req, res);

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

// Force deploy hash 7

