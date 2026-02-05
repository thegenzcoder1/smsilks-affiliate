const axios = require("axios");

exports.submitContactForm = async (req, res) => {
  const { name, email, query } = req.body;

  // Basic validation
  if (!name || !email || !query) {
    return res.status(400).json({
      success: false,
      message: "Name, Email and Query are required"
    });
  }

  // Word count validation (10–500 words)
  const wordCount = query.trim().split(/\s+/).length;

  if (wordCount < 2 || wordCount > 500) {
    return res.status(400).json({
      success: false,
      message: "Query must be between 5 and 500 words"
    });
  }

  // Email format validation (simple)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  // For now: just log (later → DB / Email / CRM)
  console.log("📩 New Website Request:");
  console.log({ name, email, query });

    try {
    const formData = new URLSearchParams();

    // YOUR REAL FIELD IDS
    formData.append("entry.1384425937", name);   // Name Of The User
    formData.append("entry.1710526294", email);  // EmailId
    formData.append("entry.37756503", query);    // Query For The Website

    await axios.post(
      "https://docs.google.com/forms/u/0/d/e/1FAIpQLScCl9aa7u3JjQO0p8lMFI-Dgcr2KlZaPJvsMwgkNvlhIm4NdA/formResponse",
      formData,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    return res.status(201).json({
      success: true,
      message: "Your request has been submitted successfully!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit form"
    });
  }

//   return res.status(201).json({
//     success: true,
//     message: "Your request has been received. We will contact you soon!"
//   });
};