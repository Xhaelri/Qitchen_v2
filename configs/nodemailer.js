import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.STMP_EMAIL,
    pass: process.env.STMP_PASS,
  },
});

export { transporter };
