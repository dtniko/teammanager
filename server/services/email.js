const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    return transporter;
}

// Invia l'email di benvenuto con le credenziali temporanee
async function sendWelcomeEmail({ to, firstName, temporaryPassword }) {
    if (!process.env.EMAIL_HOST) {
        console.log(`📧 [EMAIL DISABILITATA] Password temporanea per ${to} (${firstName}): ${temporaryPassword}`);
        return { sent: false };
    }

    try {
        const mailer = getTransporter();

        await mailer.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject: 'Le tue credenziali di accesso',
            text: `Ciao ${firstName},\n\nIl tuo account e' stato creato. Ecco le tue credenziali di accesso:\n\nEmail: ${to}\nPassword temporanea: ${temporaryPassword}\n\nTi verra' chiesto di cambiare la password al primo accesso.`,
            html: `<p>Ciao ${firstName},</p><p>Il tuo account e' stato creato. Ecco le tue credenziali di accesso:</p><p>Email: <strong>${to}</strong><br>Password temporanea: <strong>${temporaryPassword}</strong></p><p>Ti verra' chiesto di cambiare la password al primo accesso.</p>`
        });

        return { sent: true };
    } catch (error) {
        console.error('Errore nell\'invio dell\'email di benvenuto:', error);
        return { sent: false };
    }
}

module.exports = { sendWelcomeEmail };
