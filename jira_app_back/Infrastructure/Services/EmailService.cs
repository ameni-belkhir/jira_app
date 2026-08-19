using Microsoft.Extensions.Options;
using Application.Interfaces;
using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using System.Threading.Tasks;

namespace Infrastructure.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly SmtpSettings _settings;

        public SmtpEmailService(IOptions<SmtpSettings> options)
        {
            _settings = options?.Value ?? new SmtpSettings();
        }

        public async Task SendVerificationCodeAsync(string toEmail, string toName, string code)
        {
            var subject = "Confirmez votre inscription \u00e0 Jira App";
            var textBody = $"Bonjour {toName},\n\nMerci pour votre inscription \u00e0 Jira App.\n\nVotre code de v\u00e9rification est : {code}\nCe code expire dans 15 minutes.\n\n\u2014 {_settings.SenderName}";
            var htmlBody = $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b"">
  <div style=""padding:28px;background:#f8fafc;border-radius:8px"">
    <h2 style=""margin:0 0 16px;color:#1e293b;font-size:20px"">Bienvenue sur Jira App</h2>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Bonjour {toName},</p>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Merci pour votre inscription. Pour activer votre compte, veuillez saisir le code de confirmation ci-dessous :</p>
    <div style=""text-align:center;margin:24px 0;padding:18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0"">
      <span style=""font-size:32px;font-weight:700;letter-spacing:8px;color:#3b82f6;font-family:monospace"">{code}</span>
    </div>
    <p style=""margin:0;color:#64748b;font-size:13px;text-align:center"">Ce code expire dans 15 minutes.</p>
  </div>
  <div style=""padding:16px;text-align:center"">
    <p style=""margin:0;color:#94a3b8;font-size:12px;line-height:1.5"">Vous recevez cet email car vous avez cr\u00e9\u00e9 un compte sur Jira App.<br/>{_settings.SenderName}</p>
  </div>
</div>";
            await SendMailAsync(toEmail, toName, subject, textBody, htmlBody);
        }

        public async Task SendResetPasswordTokenAsync(string toEmail, string toName, string token)
        {
            var subject = "R\u00e9initialisation de votre mot de passe Jira App";
            var textBody = $"Bonjour {toName},\n\nVous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe.\n\nVotre code est : {token}\nCe code expire dans 1 heure.\n\nSi vous n'avez pas demand\u00e9 cette op\u00e9ration, ignorez cet email.\n\n\u2014 {_settings.SenderName}";
            var htmlBody = $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b"">
  <div style=""padding:28px;background:#f8fafc;border-radius:8px"">
    <h2 style=""margin:0 0 16px;color:#1e293b;font-size:20px"">R\u00e9initialisation du mot de passe</h2>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Bonjour {toName},</p>
    <p style=""margin:0 0 12px;line-height:1.6;color:#475569"">Vous avez demand\u00e9 la r\u00e9initialisation de votre mot de passe. Voici votre code :</p>
    <div style=""text-align:center;margin:24px 0;padding:18px;background:#fff;border-radius:8px;border:1px solid #e2e8f0"">
      <span style=""font-size:32px;font-weight:700;letter-spacing:8px;color:#3b82f6;font-family:monospace"">{token}</span>
    </div>
    <p style=""margin:0;color:#64748b;font-size:13px;text-align:center"">Ce code expire dans 1 heure.</p>
    <p style=""margin:12px 0 0;color:#94a3b8;font-size:12px;text-align:center"">Si vous n'avez pas demand\u00e9 cette op\u00e9ration, ignorez cet email.</p>
  </div>
  <div style=""padding:16px;text-align:center"">
    <p style=""margin:0;color:#94a3b8;font-size:12px;line-height:1.5"">Jira App &mdash; {_settings.SenderName}</p>
  </div>
</div>";
            await SendMailAsync(toEmail, toName, subject, textBody, htmlBody);
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(new MailboxAddress(string.Empty, toEmail));
            message.Subject = subject;

            var isHtml = body.Contains("<") && body.Contains(">");
            if (isHtml)
            {
                var textBody = System.Text.RegularExpressions.Regex.Replace(body, "<[^>]+>", "");
                textBody = System.Net.WebUtility.HtmlDecode(textBody);
                var multipart = new Multipart("alternative");
                multipart.Add(new TextPart("plain") { Text = textBody });
                multipart.Add(new TextPart("html") { Text = body });
                message.Body = multipart;
            }
            else
            {
                message.Body = new TextPart("plain") { Text = body };
            }

            using var client = new MailKit.Net.Smtp.SmtpClient();
            await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }

        private async Task SendMailAsync(string toEmail, string toName, string subject, string textBody, string htmlBody)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;

            var multipart = new Multipart("alternative");
            multipart.Add(new TextPart("plain") { Text = textBody });
            multipart.Add(new TextPart("html") { Text = htmlBody });
            message.Body = multipart;

            using var client = new MailKit.Net.Smtp.SmtpClient();
            await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
    }
}
