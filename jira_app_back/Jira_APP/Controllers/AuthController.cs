using System.Threading.Tasks;
using Application.DTO.Auth;
using Application.Interfaces;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly ApplicationDbContext _db;
        private readonly Microsoft.Extensions.Logging.ILogger<AuthController> _logger;

        public AuthController(IAuthService auth, ApplicationDbContext db, Microsoft.Extensions.Logging.ILogger<AuthController> logger)
        {
            _auth = auth;
            _db = db;
            _logger = logger;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                await _auth.RegisterAsync(dto);
                return Created(string.Empty, new { message = "Compte créé. Veuillez vérifier votre boîte mail pour entrer le code de confirmation." });
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

        [HttpPost("verify-code")]
        public async Task<IActionResult> VerifyCode([FromBody] Application.DTO.Auth.VerifyCodeDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var ok = await _auth.VerifyCodeAsync(dto);
                if (!ok) return BadRequest(new { error = "Code invalide ou expiré." });
                return Ok(new { message = "E-mail vérifié avec succès." });
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "VerifyCode failed for {Email}", dto.Email);
                return BadRequest(new { error = ex.Message });
            }
        }

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

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var ok = await _auth.ChangePasswordAsync(userId, dto.NewPassword);
            if (!ok) return NotFound();

            return NoContent();
        }

        [Authorize]
        [HttpGet("me/permissions")]
        public async Task<ActionResult<IEnumerable<string>>> GetMyPermissions()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized();
            }

            var permissions = await _db.UserPermissions
                .AsNoTracking()
                .Where(p => p.UserId == userId && p.IsEnabled)
                .Select(p => p.InterfaceKey)
                .ToListAsync();

            return Ok(permissions);
        }
    }
}
