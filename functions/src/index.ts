import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Load SMTP env variables
const smtp = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
};

//Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
        user: smtp.user,
        pass: smtp.pass,
    },
});

//callable function for sending email
export const sendTeacherEmail = functions.https.onCall(async (request) => {
    const data = request.data || {};

    console.log('Incoming data:', data);

    //normalize "to"
    const toRaw = data.to;
    const to: string[] = Array.isArray(toRaw)
        ? toRaw.filter((e: string) => e && e.trim().length > 0)
        : toRaw
        ? [toRaw]
        : [];

    //normailize "cc"
    const ccRaw = data.cc;
    const cc: string[] = Array.isArray(ccRaw)
        ? ccRaw.filter((e: string) => e && e.trim().length > 0)
        : ccRaw
        ? [ccRaw]
        : [];

    const subject = (data.subject || '').toString().trim();
    const body = (data.body || '').toString().trim();

    //validation
    if (to.length === 0 || subject.length === 0 || body.length === 0) {
        console.error('Validation failed:', { to, subject, body });
        throw new functions.https.HttpsError('invalid-argument', 'Missing to, subject, or body.');
    }

    //build email body
    const mailOptions = {
        from: smtp.from,
        to: to,
        cc: cc && cc.length > 0 ? cc : undefined,
        subject: subject,
        html: `<div>${body}</div>`,
    };

    //send email
    try {
        console.log('Sending email with:', { to, cc, subject });
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (err) {
        console.error('Email error:', err);
        throw new functions.https.HttpsError('unknown', 'Error sending email.');
    }
});
