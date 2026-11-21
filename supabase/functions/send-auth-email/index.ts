
import React from "npm:react@19.3.0";
import { render } from "npm:@react-email/render@2.1.0";
import { Resend } from "npm:resend@^6";
import { Webhook } from "npm:standardwebhooks@^1";
import { withSupabase } from "npm:@supabase/server@^1";

import { SignupEmail } from "./_templates/signup.tsx";
import { InviteEmail } from "./_templates/invite.tsx";
import { MagicLinkEmail } from "./_templates/magic-link.tsx";
import { RecoveryEmail } from "./_templates/recovery.tsx";
import { EmailChangeEmail } from "./_templates/email-change.tsx";
import { ReauthenticationEmail } from "./_templates/reauthentication.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") ?? "");
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "")
  .replace(/^v1,whsec_/, "");

const FROM = "ABJAD Engineering Works <invoices@abjadengineeringworks.in>";
const SITE_NAME = "ABJAD ERP";

type Payload = {
  user: {
    email: string;
    new_email?: string;
  };
  email_data: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    email_action_type: string;
  };
};

function verifyUrl(hash: string, type: string, redirect?: string) {
  const url = new URL("/auth/v1/verify", Deno.env.get("SUPABASE_URL")!);
  url.searchParams.set("token", hash);
  url.searchParams.set("type", type);
  if (redirect) url.searchParams.set("redirect_to", redirect);
  return url.toString();
}

async function send(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
  });
  if (error) throw error;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      if (!hookSecret || !Deno.env.get("RESEND_API_KEY")) {
        throw new Error("Required email secrets are missing.");
      }

      const payload = await req.text();
      const webhook = new Webhook(hookSecret);
      const { user, email_data: data } = webhook.verify(
        payload,
        Object.fromEntries(req.headers),
      ) as Payload;

      const siteUrl = data.site_url || "https://abjadengineeringworks.in";
      const recipient = user.email;
      const url = (hash: string) =>
        verifyUrl(hash, data.email_action_type, data.redirect_to);

      switch (data.email_action_type) {
        case "signup": {
          const html = await render(React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl,
            recipient,
            confirmationUrl: url(data.token_hash ?? ""),
          }));
          await send(recipient, "Confirm your email", html);
          break;
        }

        case "invite": {
          const html = await render(React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl,
            confirmationUrl: url(data.token_hash ?? ""),
          }));
          await send(recipient, "You've been invited", html);
          break;
        }

        case "magiclink": {
          const html = await render(React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl: url(data.token_hash ?? ""),
          }));
          await send(recipient, "Your login link", html);
          break;
        }

        case "recovery": {
          const html = await render(React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl: url(data.token_hash ?? ""),
            token: data.token ?? "",
          }));
          await send(recipient, "Reset your password", html);
          break;
        }

        case "email_change": {
          const newEmail = user.new_email;
          if (!newEmail) throw new Error("New email is missing.");

          const makeHtml = (hash: string) =>
            render(React.createElement(EmailChangeEmail, {
              siteName: SITE_NAME,
              oldEmail: recipient,
              email: newEmail,
              newEmail,
              confirmationUrl: url(hash),
            }));

          if (data.token_hash_new && data.token_hash) {
            // Secure change: current address gets token_hash_new.
            // New address gets token_hash.
            const [oldHtml, newHtml] = await Promise.all([
              makeHtml(data.token_hash_new),
              makeHtml(data.token_hash),
            ]);

            await Promise.all([
              send(recipient, "Confirm your new email", oldHtml),
              send(newEmail, "Confirm your new email", newHtml),
            ]);
          } else {
            // Non-secure change: only the new address is confirmed.
            const hash = data.token_hash;
            if (!hash) throw new Error("Email change token hash is missing.");
            await send(
              newEmail,
              "Confirm your new email",
              await makeHtml(hash),
            );
          }
          break;
        }

        case "reauthentication": {
          const html = await render(
            React.createElement(ReauthenticationEmail, {
              token: data.token ?? "",
            }),
          );
          await send(recipient, "Your verification code", html);
          break;
        }

        default:
          throw new Error(`Unsupported email type: ${data.email_action_type}`);
      }

      return Response.json({}, { status: 200 });
    } catch (error) {
      console.error("Auth email hook failed:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Email failed" },
        { status: 500 },
      );
    }
  }),
};
