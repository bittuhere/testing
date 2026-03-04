const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/send-email', async (req, res) => {
    const { userEmail, subject, message } = req.body;

    // Check karein ki variables mil rahe hain ya nahi
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return res.status(500).send({ message: "Config Missing" });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, 
        replyTo: userEmail,
        subject: `New: ${subject}`,
        text: `From: ${userEmail}\n\nMessage:\n${message}`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Email Sent Successfully!");
        res.status(200).send({ message: "Sent" });
    } catch (error) {
        console.error("Nodemailer Error:", error);
        res.status(500).send({ message: "Error in Sending", details: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Email Server live on port ${PORT}`));
