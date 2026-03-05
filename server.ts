import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for PDF uploads
  app.use(express.json({ limit: '10mb' }));

  // Check configuration endpoint
  app.get("/api/check-config", (req, res) => {
    const missingVars = [];
    if (!process.env.SMTP_HOST) missingVars.push("SMTP_HOST");
    if (!process.env.SMTP_USER) missingVars.push("SMTP_USER");
    if (!process.env.SMTP_PASS) missingVars.push("SMTP_PASS");

    if (missingVars.length > 0) {
      return res.status(500).json({ 
        status: "error",
        missing: missingVars
      });
    }
    res.json({ status: "ok" });
  });

  // Email sending endpoint
  app.post("/api/send-email", async (req, res) => {
    const { to, name, guide, pdfBase64 } = req.body;

    const missingVars = [];
    if (!process.env.SMTP_HOST) missingVars.push("SMTP_HOST");
    if (!process.env.SMTP_USER) missingVars.push("SMTP_USER");
    if (!process.env.SMTP_PASS) missingVars.push("SMTP_PASS");

    if (missingVars.length > 0) {
      return res.status(500).json({ 
        error: `Error de configuración: Faltan las variables ${missingVars.join(", ")}. Configúralas en el panel de variables de entorno.` 
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
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
      res.json({ success: true });
    } catch (error: any) {
      console.error("Email error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
