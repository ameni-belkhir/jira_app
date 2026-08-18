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
            var subject = "[Jira App] Vérification de votre adresse e-mail";
            var body = $"Bonjour {toName},\n\nVotre code de vérification est : {code}\nCe code expire dans 15 minutes.\n\nCordialement,\n{_settings.SenderName}";
            await SendMailAsync(toEmail, toName, subject, body);
        }

        public async Task SendResetPasswordTokenAsync(string toEmail, string toName, string token)
        {
            var subject = "[Jira App] Réinitialisation de votre mot de passe";
            var body = $"Bonjour {toName},\n\nVotre code de réinitialisation est : {token}\nCe code expire dans 1 heure.\n\nSi vous n'avez pas demandé cette opération, ignorez cet e-mail.\n\nCordialement,\n{_settings.SenderName}";
            await SendMailAsync(toEmail, toName, subject, body);
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(new MailboxAddress(string.Empty, toEmail));
            message.Subject = subject;
            message.Body = new TextPart("plain") { Text = body };

            using var client = new MailKit.Net.Smtp.SmtpClient();
            await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }

        private async Task SendMailAsync(string toEmail, string toName, string subject, string body)
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(new MailboxAddress(toName, toEmail));
            message.Subject = subject;
            message.Body = new TextPart("plain") { Text = body };

            using var client = new MailKit.Net.Smtp.SmtpClient();
            // Connect using StartTls
            await client.ConnectAsync(_settings.Server, _settings.Port, SecureSocketOptions.StartTls);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
    }
}
