using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using Application.Interfaces;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class MailjetEmailService : IEmailService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly MailjetSettings _settings;

        public MailjetEmailService(IHttpClientFactory httpClientFactory, IOptions<MailjetSettings> options)
        {
            _httpClientFactory = httpClientFactory;
            _settings = options?.Value ?? new MailjetSettings();
        }

        public async Task SendVerificationCodeAsync(string toEmail, string toName, string code)
        {
            var subject = "Confirmez votre inscription \u00e0 Jira App";
            var body = $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b"">
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
            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendResetPasswordTokenAsync(string toEmail, string toName, string token)
        {
            var subject = "R\u00e9initialisation de votre mot de passe Jira App";
            var body = $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1e293b"">
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
            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var client = _httpClientFactory.CreateClient("Mailjet");

            var textBody = System.Text.RegularExpressions.Regex.Replace(body, "<[^>]+>", "");
            textBody = System.Net.WebUtility.HtmlDecode(textBody);

            var payload = new
            {
                Messages = new[]
                {
                    new
                    {
                        From = new { Email = _settings.SenderEmail, Name = _settings.SenderName },
                        To = new[] { new { Email = toEmail } },
                        Subject = subject,
                        HTMLPart = body,
                        TextPart = textBody
                    }
                }
            };

            var response = await client.PostAsJsonAsync("https://api.mailjet.com/v3.1/send", payload);
            response.EnsureSuccessStatusCode();
        }
    }
}
