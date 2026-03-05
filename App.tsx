import { Handler } from "@netlify/functions";

export const handler: Handler = async (event, context) => {
  const missingVars = [];
  if (!process.env.SMTP_HOST) missingVars.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missingVars.push("SMTP_USER");
  if (!process.env.SMTP_PASS) missingVars.push("SMTP_PASS");

  if (missingVars.length > 0) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        status: "error",
        missing: missingVars
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ status: "ok" }),
  };
};
