using System.Threading.Tasks;
using Application.DTO.Auth;
using Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly Microsoft.Extensions.Logging.ILogger<AuthController> _logger;

        public AuthController(IAuthService auth, Microsoft.Extensions.Logging.ILogger<AuthController> logger)
        {
            _auth = auth;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                await _auth.RegisterAsync(dto);
                return Created(string.Empty, new { message = "Compte créé." });
            }
            catch (System.InvalidOperationException ex)
            {
                _logger.LogError(ex, "Register failed for {Email}", dto.Email);
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var res = await _auth.LoginAsync(dto);
                if (res == null) return Unauthorized();
                return Ok(res);
            }
            catch (System.InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // VerifyCode endpoint removed: registration now activates user immediately.

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] Application.DTO.Auth.ForgotPasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var ok = await _auth.ForgotPasswordAsync(dto);
                if (!ok) return BadRequest(new { error = "Impossible d'initier la réinitialisation." });
                return Ok(new { message = "Code de réinitialisation envoyé si l'adresse existe." });
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "ForgotPassword failed for {Email}", dto.Email);
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] Application.DTO.Auth.ResetPasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var ok = await _auth.ResetPasswordAsync(dto);
                if (!ok) return BadRequest(new { error = "Token invalide ou expiré." });
                return Ok(new { message = "Mot de passe réinitialisé avec succès." });
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "ResetPassword failed for {Email}", dto.Email);
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
