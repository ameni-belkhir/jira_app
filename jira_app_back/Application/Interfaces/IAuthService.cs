using System.Threading.Tasks;
using Application.DTO.Auth;

namespace Application.Interfaces
{
    public interface IAuthService
    {
        Task RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
        Task<bool> VerifyCodeAsync(Application.DTO.Auth.VerifyCodeDto dto);
        Task<bool> ForgotPasswordAsync(Application.DTO.Auth.ForgotPasswordDto dto);
        Task<bool> ResetPasswordAsync(Application.DTO.Auth.ResetPasswordDto dto);
    }
}
