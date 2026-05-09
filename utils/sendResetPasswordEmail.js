const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendResetPasswordEmail(email, code) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your Lumina password",
    html: `
      <div style="background:#0a1428;padding:40px;font-family:Arial;color:white;">
        <h1 style="color:#d4af37;">Lumina Password Reset</h1>
        <p>Your password reset code is:</p>
        <div style="font-size:42px;font-weight:bold;letter-spacing:8px;margin:30px 0;color:#d4af37;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      </div>
    `
  });
}

module.exports = sendResetPasswordEmail;