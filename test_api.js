const fetch = require("node-fetch");
(async () => {
  const url = "https://api-2jtv46nvba-uc.a.run.app/api";
  const payload = { action: "studentLogin", args: ["MSC/26/0005", "Welcome@1"] };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    console.log("Status:", response.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
