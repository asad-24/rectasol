import "server-only";
import { inquiryEmailSchema, messageSchema, type EmailInquiry, type EmailKind } from "@/lib/server/email/model";

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(title)}</title></head><body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,sans-serif;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:12px"><tr><td style="padding:28px;overflow-wrap:anywhere"><p style="font-size:24px;font-weight:bold">Recta<span style="color:#c2410c">sol</span></p><h1 style="font-size:24px">${escapeEmailHtml(title)}</h1>${body}<hr style="border:0;border-top:1px solid #e2e8f0;margin-top:28px"><p style="font-size:12px;color:#475569">Rectasol · Project inquiries</p></td></tr></table></td></tr></table></body></html>`;
}

export function renderInquiryEmail(kind: EmailKind, input: EmailInquiry,
  config: { from: { email: string; name: string }; recipients: string[]; siteUrl: string }) {
  const inquiry = inquiryEmailSchema.parse(input);
  const service = inquiry.service.replaceAll("-", " ");
  const e = escapeEmailHtml;
  if (kind === "inquiry_client_v1") {
    const title = "We received your inquiry";
    const next = "Our team will review your project details and contact you to discuss suitable next steps. Keep this reference for future correspondence.";
    return messageSchema.parse({
      from: config.from, to: [inquiry.email], subject: `Your Rectasol inquiry ${inquiry.public_reference}`,
      text: `Rectasol\n\n${title}\n\nHello ${inquiry.name},\n\nThank you for contacting Rectasol.\nReference: ${inquiry.public_reference}\nService: ${service}\n\n${next}`,
      html: layout(title, `<p>Hello ${e(inquiry.name)},</p><p>Thank you for contacting Rectasol.</p><p><strong>Reference:</strong> ${e(inquiry.public_reference)}<br><strong>Service:</strong> ${e(service)}</p><p>${next}</p>`),
    });
  }
  if (kind !== "inquiry_admin_v1") throw new Error("Unsupported email type.");
  const origin = new URL(config.siteUrl);
  const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if ((origin.protocol !== "https:" && !localHttp) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Email link configuration unavailable.");
  }
  const link = `${origin.origin}/admin/inquiries/${inquiry.id}`;
  const fields = [["Reference", inquiry.public_reference], ["Name", inquiry.name], ["Email", inquiry.email],
    ["Company", inquiry.company || "Not specified"], ["Service", service],
    ["Budget", inquiry.budget || "Not specified"], ["Timeline", inquiry.timeline || "Not specified"]];
  return messageSchema.parse({
    from: config.from, to: config.recipients, subject: `New Rectasol inquiry ${inquiry.public_reference}`,
    text: `Rectasol\n\nNew project inquiry\n\n${fields.map(([label,value]) => `${label}: ${value}`).join("\n")}\n\nMessage:\n${inquiry.message}\n\nReview inquiry (admin sign-in required): ${link}`,
    html: layout("New project inquiry", `<dl>${fields.map(([label,value]) => `<dt style="font-weight:bold">${label}</dt><dd style="margin:0 0 12px">${e(value)}</dd>`).join("")}</dl><h2 style="font-size:18px">Project message</h2><p style="white-space:pre-wrap">${e(inquiry.message)}</p><p><a href="${e(link)}" style="color:#9a3412">Review inquiry</a> (admin sign-in required)</p>`),
  });
}
