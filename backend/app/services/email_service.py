import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppException

logger = logging.getLogger("saf_studio.email")


class EmailDeliveryException(AppException):
    """Raised when transactional email dispatch fails."""

    def __init__(
        self,
        message: str = "Unable to deliver verification code. Please try again later.",
        issue: str = "Email provider delivery failure",
    ):
        super().__init__(
            message=message,
            code="EMAIL_DELIVERY_FAILED",
            status_code=503,
            details=[{"field": "email", "issue": issue}],
        )


def render_otp_email_html(otp_code: str, expiry_minutes: int = 10) -> str:
    """Render branded luxury HTML email template for SAF Studio password recovery."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SAF Studio Verification Code</title>
  <style>
    body {{
      margin: 0; padding: 0; background-color: #0F0F11;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #E5E5E7;
    }}
    .wrapper {{
      width: 100%; max-width: 560px; margin: 40px auto;
      background-color: #1A1A1E; border-radius: 12px;
      border: 1px solid #2C2C32; overflow: hidden;
    }}
    .header {{
      padding: 32px 40px; text-align: center;
      border-bottom: 1px solid #2C2C32;
    }}
    .brand-title {{
      font-size: 20px; font-weight: 600; letter-spacing: 2px;
      color: #FFFFFF; text-transform: uppercase; margin: 0;
    }}
    .brand-subtitle {{
      font-size: 11px; letter-spacing: 1.5px;
      color: #C5A880; text-transform: uppercase; margin-top: 6px;
    }}
    .content {{ padding: 40px; text-align: center; }}
    .title {{ font-size: 22px; font-weight: 500; color: #FFFFFF; margin: 0 0 12px; }}
    .description {{ font-size: 14px; line-height: 22px; color: #A1A1AA; margin: 0 0 32px; }}
    .otp-container {{
      display: inline-block; background-color: #24242A;
      border: 1px solid #3F3F46; border-radius: 8px;
      padding: 16px 36px; margin-bottom: 32px;
    }}
    .otp-code {{
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 36px; font-weight: 700; letter-spacing: 8px;
      color: #E4C89F; margin: 0;
    }}
    .expiry-note {{ font-size: 13px; color: #71717A; margin-bottom: 24px; }}
    .security-callout {{
      background-color: #202026; border-left: 3px solid #C5A880;
      padding: 14px 18px; text-align: left;
      border-radius: 0 6px 6px 0; margin-bottom: 20px;
    }}
    .security-text {{ font-size: 12px; line-height: 18px; color: #A1A1AA; margin: 0; }}
    .footer {{
      padding: 24px 40px; text-align: center;
      font-size: 12px; color: #52525B; border-top: 1px solid #2C2C32;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-title">Sagar Arts &amp; Frames</div>
      <div class="brand-subtitle">Fine Art &amp; Memory Wall Studio</div>
    </div>
    <div class="content">
      <h1 class="title">Password Reset Verification</h1>
      <p class="description">
        We received a request to reset the password for your SAF Studio account.
        Enter this 6-digit verification code to proceed:
      </p>
      <div class="otp-container">
        <div class="otp-code">{otp_code}</div>
      </div>
      <p class="expiry-note">
        This code expires in <strong>{expiry_minutes} minutes</strong>.
        Never share this code with anyone.
      </p>
      <div class="security-callout">
        <p class="security-text">
          <strong>Didn’t request this?</strong> If you did not ask to reset your password,
          you can safely disregard this email. Your current password remains active.
        </p>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 Sagar Arts &amp; Frames Studio. All rights reserved.<br>
      Automated security transmission. Replies are not monitored.
    </div>
  </div>
</body>
</html>"""


def render_otp_email_text(otp_code: str, expiry_minutes: int = 10) -> str:
    """Render plain-text fallback email for clients with HTML disabled."""
    return f"""SAF STUDIO — PASSWORD RESET CODE
------------------------------------------------------
Your 6-digit verification code is: {otp_code}

This code expires in {expiry_minutes} minutes.

If you did not request a password reset, please ignore this email.
Your account remains secure.

— Sagar Arts & Frames Studio
"""


class EmailService:
    """Asynchronous transactional email service supporting Resend and Mock providers."""

    def __init__(self) -> None:
        self.mock_sent_emails: list[dict[str, Any]] = []

    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        expiry_minutes: int | None = None,
    ) -> bool:
        """Dispatch branded 6-digit OTP email via Resend or recording mock."""
        settings = get_settings()
        expire_mins = expiry_minutes or settings.EMAIL_OTP_EXPIRE_MINUTES

        subject = f"{otp_code} is your SAF Studio verification code"
        html_body = render_otp_email_html(otp_code, expire_mins)
        text_body = render_otp_email_text(otp_code, expire_mins)

        # 1. Mock provider (used for testing and explicit offline dev)
        if settings.EMAIL_PROVIDER == "mock":
            record = {
                "to": to_email,
                "subject": subject,
                "otp_code": otp_code,
                "expiry_minutes": expire_mins,
            }
            self.mock_sent_emails.append(record)
            if settings.is_development:
                logger.debug(
                    "[DEV ONLY MOCK] OTP for %s: %s (expires in %d min)",
                    to_email,
                    otp_code,
                    expire_mins,
                )
            else:
                logger.info("Mock email recorded for recipient %s", to_email)
            return True

        # 2. Resend production/live provider
        if settings.EMAIL_PROVIDER == "resend":
            if not settings.RESEND_API_KEY.strip():
                logger.error("EMAIL_PROVIDER is 'resend' but RESEND_API_KEY is missing or empty")
                raise EmailDeliveryException(
                    message="Email delivery service is misconfigured.",
                    issue="Missing RESEND_API_KEY",
                )

            payload = {
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            }

            headers = {
                "Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}",
                "Content-Type": "application/json",
            }

            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        json=payload,
                        headers=headers,
                    )

                if resp.status_code in (200, 201):
                    logger.info("Password reset OTP email dispatched successfully via Resend")
                    return True

                logger.error(
                    "Resend API rejected delivery: status=%d response=%s",
                    resp.status_code,
                    resp.text,
                )
                raise EmailDeliveryException(
                    message="Failed to deliver verification code via email.",
                    issue=f"Resend HTTP {resp.status_code}",
                )

            except httpx.TimeoutException as exc:
                logger.error("Resend API timed out after 5.0 seconds")
                raise EmailDeliveryException(
                    message="Email delivery service timed out. Please try again.",
                    issue="Resend timeout",
                ) from exc
            except httpx.RequestError as exc:
                logger.error("Resend connection error: %s", exc)
                raise EmailDeliveryException(
                    message="Network error communicating with email provider.",
                    issue=str(exc),
                ) from exc

        logger.error("Unknown EMAIL_PROVIDER: %s", settings.EMAIL_PROVIDER)
        raise EmailDeliveryException(
            message="Unsupported email provider configuration.",
            issue=f"Unknown provider '{settings.EMAIL_PROVIDER}'",
        )


# Global singleton instance for injection and test inspection
email_service = EmailService()
