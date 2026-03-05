const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => { res.send("<h1>Mail Server is Ready!</h1>"); });

app.post('/send-email', async (req, res) => {
    const { userEmail, subject, message } = req.body;

    // Aggressive Connection Settings
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Port 587 ke liye hamesha false
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false, // Certificate errors ignore karega
            minVersion: 'TLSv1.2'
        },
        logger: true, // Logs mein details dikhayega
        debug: true,  // Handshake process dikhayega
        connectionTimeout: 30000, // 30 seconds wait karega
        greetingTimeout: 30000,
        socketTimeout: 30000
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        replyTo: userEmail,
        subject: `Form: ${subject}`,
        text: `From: ${userEmail}\n\nMessage: ${message}`
    };

    try {
        console.log("Sending email...");
        let info = await transporter.sendMail(mailOptions);
        console.log("SUCCESS: Message sent! ID:", info.messageId);
        res.status(200).send({ message: "Sent" });
    } catch (error) {
        console.error("DETAILED ERROR:", error.message);
        res.status(500).send({ message: "Connection Failed", details: error.message });
    }
});

app.listen(process.env.PORT || 10000, () => console.log("Email server started!"));
