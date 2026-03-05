import { Handler } from "@netlify/functions";
import nodemailer from "nodemailer";

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { to, name, guide, pdfBase64 } = JSON.parse(event.body || "{}");

    const missingVars = [];
    if (!process.env.SMTP_HOST) missingVars.push("SMTP_HOST");
    if (!process.env.SMTP_USER) missingVars.push("SMTP_USER");
    if (!process.env.SMTP_PASS) missingVars.push("SMTP_PASS");

    if (missingVars.length > 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: `Error de configuración: Faltan las variables ${missingVars.join(", ")}. Configúralas en el panel de Netlify.` 
        }),
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Cubitt Shipping" <no-reply@cubitt.com>',
      to: to,
      subject: `Tu envío ya está en camino 🚚 | Guía #${guide}`,
      text: `Hola ${name},\n\nTu pedido ha sido enviado. Adjunto encontrarás tu guía de envío.\n\nGracias por confiar en Cubitt.`,
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>¡Hola ${name}! 👋</h2>
          <p>Tu pedido ya está en camino.</p>
          <p><strong>Número de guía:</strong> ${guide}</p>
          <p>Adjunto encontrarás el documento de tu guía de envío.</p>
          <br>
          <p>Gracias por elegir Cubitt.</p>
        </div>
      `,
      attachments: [
        {
          filename: `Guia_Cubitt_${guide}.pdf`,
          content: pdfBase64.split('base64,')[1],
          encoding: 'base64',
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error: any) {
    console.error("Email error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to send email" }),
    };
  }
};
