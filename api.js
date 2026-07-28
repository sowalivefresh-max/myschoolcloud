/**
 * api.js
 * Centralized API client for communicating with the Google Apps Script Backend.
 */

// --- DEPLOYMENT CONFIGURATION ------------------------------------------------
// Replace the URL below with your own Google Apps Script Web App deployment URL or Firebase Cloud Function URL.
// -----------------------------------------------------------------------------
const SCRIPT_URL = "https://api-2jtv46nvba-uc.a.run.app";

/**
 * Calls a backend function.
 * @param {string} action - The name of the function in Code.gs
 * @param {Array} args - An array of arguments to pass to the function
 * @returns {Promise<any>}
 */
async function runBackendAction(action, args = []) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, args: args }),
      headers: {
        "Content-Type": "application/json" // Changed to application/json for Firebase Express Backend
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
