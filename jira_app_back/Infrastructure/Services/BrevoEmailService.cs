using System.Net.Http.Json;
using System.Threading.Tasks;
using Application.Interfaces;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services
{
    public class BrevoEmailService : IEmailService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly BrevoSettings _settings;

        public BrevoEmailService(IHttpClientFactory httpClientFactory, IOptions<BrevoSettings> options)
        {
            _httpClientFactory = httpClientFactory;
            _settings = options?.Value ?? new BrevoSettings();
        }

        public async Task SendVerificationCodeAsync(string toEmail, string toName, string code)
        {
            var subject = "[Jira App] Vérification de votre adresse e-mail";
            var body = $"<p>Bonjour {toName},</p><p>Votre code de vérification est : <strong>{code}</strong></p><p>Ce code expire dans 15 minutes.</p><p>Cordialement,<br/>{_settings.SenderName}</p>";
            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendResetPasswordTokenAsync(string toEmail, string toName, string token)
        {
            var subject = "[Jira App] Réinitialisation de votre mot de passe";
            var body = $"<p>Bonjour {toName},</p><p>Votre code de réinitialisation est : <strong>{token}</strong></p><p>Ce code expire dans 1 heure.</p><p>Si vous n'avez pas demandé cette opération, ignorez cet e-mail.</p><p>Cordialement,<br/>{_settings.SenderName}</p>";
            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var client = _httpClientFactory.CreateClient("Brevo");
            var payload = new
            {
                sender = new { name = _settings.SenderName, email = _settings.SenderEmail },
                to = new[] { new { email = toEmail } },
                subject,
                htmlContent = body
            };

            var response = await client.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", payload);
            response.EnsureSuccessStatusCode();
        }
    }
}
