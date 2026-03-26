const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 25,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "",
        pass: "",
    },
});
module.exports = {
    // Support both old signature (to, url) and new signature (to, subject, text, html)
    sendMail: async function (to, subjectOrUrl, text, html) {
        let subject = "reset password URL";
        let bodyText = "click vao day de doi pass";
        let bodyHtml = typeof subjectOrUrl === 'string' ? `click vao <a href="${subjectOrUrl}">day</a> de doi pass` : "";

        if (text || html) {
            subject = subjectOrUrl || subject;
            bodyText = text || "";
            bodyHtml = html || text || "";
        }

        const info = await transporter.sendMail({
            from: 'no-reply@example.com',
            to: to,
            subject: subject,
            text: bodyText,
            html: bodyHtml,
        });

        console.log("Message sent:", info.messageId);
    }
};
