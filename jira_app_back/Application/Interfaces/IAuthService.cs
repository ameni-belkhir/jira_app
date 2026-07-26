using System.Threading.Tasks;
using Application.DTO.Auth;

namespace Application.Interfaces
{
    public interface IAuthService
    {
        Task RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto?> LoginAsync(LoginDto dto);
        Task<bool> ForgotPasswordAsync(ForgotPasswordDto dto);
        Task<bool> ResetPasswordAsync(ResetPasswordDto dto);
    }
}
