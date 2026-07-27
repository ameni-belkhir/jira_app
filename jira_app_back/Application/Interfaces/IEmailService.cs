using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IEmailService
    {
        Task SendVerificationCodeAsync(string toEmail, string toName, string code);
        Task SendResetPasswordTokenAsync(string toEmail, string toName, string token);
        Task SendEmailAsync(string toEmail, string subject, string body);
    }
}
