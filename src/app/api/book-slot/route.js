import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

export async function POST(req) {
  try {
    const data = await req.json();
    // Basic server-side validation
    const regex = {
      text: /^(?!.*(<|>|script|http|www|\.com|@)).{1,50}$/i,
      desc: /^(?!.*(<|>|script|http|www|\.com)).{0,200}$/i,
      email: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
    };
    if (
      !regex.text.test(data.projectName) ||
      !["IT", "Mines and minerals", "Management", "BioInformatices"].includes(data.departmentName) ||
      !data.startDate ||
      !data.endDate ||
      !data.time ||
      !regex.text.test(data.purpose) ||
      !regex.desc.test(data.description) ||
      !regex.email.test(data.email)
    ) {
      return new Response(JSON.stringify({ error: "Invalid input." }), { status: 400 });
    }

    // SVG icons (inline for email compatibility)
    const icons = {
      project: `<svg width='20' height='20' fill='none' stroke='#a259f7' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><rect x='3' y='7' width='18' height='13' rx='2'/><path d='M16 3v4M8 3v4M3 11h18'/></svg>`,
      department: `<svg width='20' height='20' fill='none' stroke='#f7b32b' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><circle cx='12' cy='7' r='4'/><path d='M5.5 21a7.5 7.5 0 0 1 13 0'/></svg>`,
      date: `<svg width='20' height='20' fill='none' stroke='#16a34a' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v2M8 3v2M3 9h18'/></svg>`,
      time: `<svg width='20' height='20' fill='none' stroke='#2563eb' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><circle cx='12' cy='12' r='10'/><path d='M12 6v6l4 2'/></svg>`,
      purpose: `<svg width='20' height='20' fill='none' stroke='#db2777' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><circle cx='12' cy='12' r='10'/><path d='M12 8v4l3 3'/></svg>`,
      description: `<svg width='20' height='20' fill='none' stroke='#b45309' stroke-width='2' viewBox='0 0 24 24' style='vertical-align:middle;'><rect x='4' y='4' width='16' height='16' rx='2'/><path d='M8 8h8M8 12h8M8 16h4'/></svg>`
    };

    // Set up Azure credentials
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    const sender = "admin@aas.technology"; // The mailbox to send from

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const token = await credential.getToken("https://graph.microsoft.com/.default");
    const client = Client.init({
      authProvider: (done) => {
        done(null, token.token);
      },
    });

    // Build your email message
    const mail = {
      message: {
        subject: "Slot Booking Request Received",
        body: {
          contentType: "HTML",
          content: `
            <div style="max-width:420px;margin:24px auto;padding:0;font-family:Arial,sans-serif;background:#fff;border-radius:18px;box-shadow:0 4px 24px #0001;overflow:hidden;border:2px dashed #7d92a7;">
              <div style="background:linear-gradient(90deg,#7d92a7 0%,#586364 100%);color:#fff;padding:18px 0;text-align:center;font-size:1.3rem;font-weight:bold;letter-spacing:1px;position:relative;">
                <span style='color:#d1c061;'>🎟️ Time Slot Book</span>
                <span style="position:absolute;left:0;top:0;width:32px;height:32px;background:#fff;border-radius:0 0 18px 0;"></span>
                <span style="position:absolute;right:0;top:0;width:32px;height:32px;background:#fff;border-radius:0 0 0 18px;"></span>
              </div>
              <div style="padding:24px 24px 12px 24px;">
                <div style="margin-bottom:12px;font-size:1.1rem;font-weight:600;text-align:center;color:#d1c061;">Slot Booking Request</div>
                <ul style="list-style:none;padding:0;margin:0;font-size:1rem;">
                  <li style="margin-bottom:10px;">${icons.project} <b style='margin-left:4px;'>Project Name:</b> ${data.projectName}</li>
                  <li style="margin-bottom:10px;">${icons.department} <b style='margin-left:4px;'>Department Name:</b> ${data.departmentName}</li>
                  <li style="margin-bottom:10px;">${icons.date} <b style='margin-left:4px;'>Start Date:</b> ${data.startDate}</li>
                  <li style="margin-bottom:10px;">${icons.date} <b style='margin-left:4px;'>End Date:</b> ${data.endDate}</li>
                  <li style="margin-bottom:10px;">${icons.time} <b style='margin-left:4px;'>Time:</b> ${data.time}</li>
                  <li style="margin-bottom:10px;">${icons.purpose} <b style='margin-left:4px;'>Purpose:</b> ${data.purpose}</li>
                  <li style="margin-bottom:10px;">${icons.description} <b style='margin-left:4px;'>Description:</b> ${data.description}</li>
                  <li style="margin-bottom:10px;">📧 <b style='margin-left:4px;'>From Email:</b> ${data.email}</li>
                </ul>
                <div style="margin-top:18px;text-align:center;font-size:1.05rem;color:#333;">A user has requested to book a time slot to meet you.<br/>Please review the details above and confirm the meeting if appropriate.<br/><br/><span style='font-size:0.95rem;color:#7d92a7;'>This digital ticket is for your reference as the meeting recipient.</span></div>
              </div>
              <div style="background:#d1c061;color:#fff;text-align:center;padding:10px 0;font-size:1rem;font-weight:600;letter-spacing:1px;">Powered by AAS Information Technology</div>
            </div>
          `,
        },
        toRecipients: [
          {
            emailAddress: {
              address: sender, // Send to imran@aas.technology
            },
          },
        ],
      },
    };

    // Send the email
    await client.api(`/users/${sender}/sendMail`).post(mail);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server error.", details: err.message }), { status: 500 });
  }
} 