const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendVerificationEmail(email, code) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Verify your Lumina account",

      html: `
        <div style="
          background:#0a1428;
          padding:40px;
          font-family:Arial;
          color:white;
        ">

          <h1 style="color:#d4af37;">
            Lumina Verification
          </h1>

          <p>Your verification code:</p>

          <div style="
            font-size:42px;
            font-weight:bold;
            letter-spacing:8px;
            margin:30px 0;
            color:#d4af37;
          ">
            ${code}
          </div>

          <p>
            This code expires in 10 minutes.
          </p>

        </div>
      `
    });

    console.log("Verification email sent:", email);

  } catch (error) {
    console.error(error);
  }
}

module.exports = sendVerificationEmail;