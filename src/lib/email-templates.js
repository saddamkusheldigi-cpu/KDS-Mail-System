/**
 * Pre-built email templates designed for high inbox deliverability,
 * rich visuals, images (up to 1 MB+), and zero-code customization.
 */

export const PRESET_TEMPLATES = [
  {
    id: "b2b-outreach",
    name: "💼 B2B Business Outreach",
    category: "Outreach",
    description: "Clean, high-converting cold email with professional branding, bullet points & CTA button.",
    subject: "Quick question for {{company}} regarding {{name}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Outreach</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 24px 32px; text-align: left;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Growth Enterprise</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #e0e7ff;">Next-Generation Business Solutions</p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">Hi {{name}},</h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                I came across your work at <strong>{{company}}</strong> and wanted to reach out directly. We recently helped similar companies scale their core operations and reduce outbound costs by over 40%.
              </p>
              
              <!-- Highlight Feature Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f172a;">How we support teams at {{company}}:</p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569;">
                      <li style="margin-bottom: 6px;">Zero server management with automated delivery</li>
                      <li style="margin-bottom: 6px;">Guaranteed 95%+ Primary Inbox placement</li>
                      <li>Direct 1-on-1 migration and 24/7 technical support</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; font-size: 15px; color: #334155;">
                Would you have 10 minutes this Thursday for a brief chat to see if this makes sense for {{company}}?
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                    <a href="https://yourdomain.com/demo" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Schedule a 10-Minute Call &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Signature -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">Kevin Sharma</p>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b;">Director of Client Growth • Digital Growth US</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">kevin.digitalgrowthus@gmail.com | yourdomain.com</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plainText: `Hi {{name}},

I came across your work at {{company}} and wanted to reach out directly. We recently helped similar companies scale their core operations and reduce outbound costs by over 40%.

How we support teams at {{company}}:
- Zero server management with automated delivery
- Guaranteed 95%+ Primary Inbox placement
- Direct 1-on-1 migration and 24/7 technical support

Would you have 10 minutes this Thursday for a brief chat to see if this makes sense for {{company}}?

Schedule a call here: https://yourdomain.com/demo

Best regards,
Kevin Sharma
Director of Client Growth | Digital Growth US`,
  },

  {
    id: "product-showcase",
    name: "🚀 Product Launch & Visual Hero Banner",
    category: "Promotional",
    description: "Designed for rich visual catalogs, hero product images (up to 1 MB+), feature highlights & demo CTA.",
    subject: "Introducing our new platform designed for {{company}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Launch</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
          
          <!-- Brand Logo Header -->
          <tr>
            <td align="center" style="padding: 24px 20px; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
              <span style="font-size: 20px; font-weight: 800; color: #4338ca; letter-spacing: -0.5px;">PROLAUNCH • STUDIO</span>
            </td>
          </tr>

          <!-- Hero Banner Image (Can be uploaded or customized) -->
          <tr>
            <td align="center" style="padding: 0; background-color: #1e1b4b;">
              <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=80" alt="Product Hero Banner" width="600" style="width: 100%; max-width: 600px; height: auto; display: block; border: 0;" />
            </td>
          </tr>

          <!-- Main Pitch -->
          <tr>
            <td style="padding: 32px 30px;">
              <div style="display: inline-block; background-color: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 12px;">
                NEW RELEASE 2026
              </div>

              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #111827; line-height: 1.3;">
                A Better, Faster Way to Scale Outreach for {{company}}
              </h1>

              <p style="margin: 0 0 20px 0; font-size: 15px; color: #4b5563;">
                Hello {{name}}, today we are thrilled to unveil our high-performance dispatch infrastructure. Built from the ground up to give {{company}} enterprise reliability without high monthly SaaS subscription fees.
              </p>

              <!-- Product Feature Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111827;">What makes this different:</h3>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563;">
                      ⚡ <strong>Instant Delivery:</strong> 1,350 emails/day with automatic throttling & human jitter.
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563;">
                      🛡️ <strong>Spam Protection:</strong> Automatic DNS and reputation safeguard to ensure 95%+ Primary Inbox placement.
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #4b5563;">
                      📊 <strong>Deep Analytics:</strong> Real-time open tracking, reply monitoring, and suppression lists.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Big CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 12px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                          <a href="https://yourdomain.com/product" target="_blank" style="display: inline-block; padding: 16px 36px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);">
                            Try the Live Demo Now &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">
                Questions? Reply directly to this email to speak with our product lead.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plainText: `Hello {{name}},

Today we are thrilled to unveil our high-performance dispatch infrastructure. Built from the ground up to give {{company}} enterprise reliability without high monthly SaaS subscription fees.

What makes this different:
- Instant Delivery: 1,350 emails/day with automatic throttling & human jitter.
- Spam Protection: Automatic DNS and reputation safeguard to ensure 95%+ Primary Inbox placement.
- Deep Analytics: Real-time open tracking, reply monitoring, and suppression lists.

Try the live demo here: https://yourdomain.com/product

Best regards,
The Product Team`,
  },

  {
    id: "special-offer",
    name: "🏷️ Exclusive Discount & Offer Promo",
    category: "Promotional",
    description: "High-impact promotional campaign with coupon discount box, urgency banner, and big CTA.",
    subject: "Special 40% VIP Partnership Offer for {{company}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exclusive Offer</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
          
          <!-- Promo Header -->
          <tr>
            <td align="center" style="background-color: #047857; padding: 32px 20px; text-align: center;">
              <span style="display: inline-block; background-color: #065f46; color: #a7f3d0; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
                LIMITED TIME PARTNERSHIP OFFER
              </span>
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">
                Save 40% On Enterprise Outreach
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #d1fae5;">
                Exclusively prepared for {{name}} and the team at {{company}}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                Hi {{name}},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #334155;">
                As part of our Q4 enterprise program, we are opening a special onboarding tier for select founders and leaders at {{company}}.
              </p>

              <!-- Coupon Code Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 10px; margin: 24px 0;">
                <tr>
                  <td align="center" style="padding: 24px;">
                    <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 1px;">YOUR VIP PROMO CODE</span>
                    <div style="margin: 8px 0; font-size: 28px; font-weight: 800; color: #065f46; letter-spacing: 2px; font-family: monospace;">
                      GROWTH40
                    </div>
                    <span style="font-size: 12px; color: #059669;">Valid for 40% off your first 3 months</span>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 8px; background-color: #059669;">
                          <a href="https://yourdomain.com/claim-offer" target="_blank" style="display: inline-block; padding: 16px 36px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
                            Claim Your 40% Discount Today &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                *Offer valid through the end of the month. No long-term contracts required.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    plainText: `Hi {{name}},

As part of our enterprise program, we are opening a special onboarding tier for select founders and leaders at {{company}}.

Save 40% on your first 3 months with your VIP Promo Code:
GROWTH40

Claim your discount here: https://yourdomain.com/claim-offer

Best regards,
The Growth Team`,
  },

  {
    id: "minimal-plain",
    name: "⚡ Minimalist 1-to-1 Personal Note (Highest Reply Rate)",
    category: "Personal Outreach",
    description: "Looks 100% hand-typed from your personal mailbox. Highest Primary Inbox placement & reply rates.",
    subject: "Quick question for {{company}} regarding {{name}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; margin: 0; padding: 16px;">
  <p>Hi {{name}},</p>
  
  <p>Hope you're having a productive week.</p>
  
  <p>I noticed your work at <strong>{{company}}</strong> and wanted to reach out briefly. We recently built a dedicated bulk email dispatch system that handles 40,000 emails/month with 95%+ Primary Inbox delivery at zero monthly database costs.</p>
  
  <p>Are you free for 10 minutes this Wednesday or Thursday to see if this could help {{company}} cut outbound expenses?</p>
  
  <p>You can check our demo here: <a href="https://yourdomain.com/demo" style="color: #4f46e5; text-decoration: underline;">https://yourdomain.com/demo</a></p>
  
  <p style="margin-top: 24px;">Best regards,<br>
  <strong>Kevin</strong><br>
  <span style="font-size: 13px; color: #6b7280;">kevin.digitalgrowthus@gmail.com</span></p>
</body>
</html>`,
    plainText: `Hi {{name}},

Hope you're having a productive week.

I noticed your work at {{company}} and wanted to reach out briefly. We recently built a dedicated bulk email dispatch system that handles 40,000 emails/month with 95%+ Primary Inbox delivery at zero monthly database costs.

Are you free for 10 minutes this Wednesday or Thursday to see if this could help {{company}} cut outbound expenses?

You can check our demo here: https://yourdomain.com/demo

Best regards,
Kevin
kevin.digitalgrowthus@gmail.com`,
  },
];
