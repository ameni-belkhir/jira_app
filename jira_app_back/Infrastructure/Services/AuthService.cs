using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Application.DTO.Auth;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Domain.Entity;
using Microsoft.EntityFrameworkCore;
using Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class AuthService : IAuthService
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _config;
        private readonly PasswordHasher<User> _passwordHasher;
        private readonly ILogger<AuthService> _logger;

        public AuthService(ApplicationDbContext db, IConfiguration config, ILogger<AuthService> logger)
        {
            _db = db;
            _config = config;
            _passwordHasher = new PasswordHasher<User>();
            _logger = logger;
        }

        public async Task RegisterAsync(RegisterDto dto)
        {
            // check existing
            var exists = await _db.Users.AnyAsync(u => u.Email == dto.Email);
            if (exists) throw new InvalidOperationException("User already exists");

            // déterminer le rôle à attribuer
            int roleIdToAssign;
            var anyUsers = await _db.Users.AnyAsync();
            if (!anyUsers)
            {
                // premier utilisateur -> ScrumMaster
                var scrumRole = await _db.Roles.FirstOrDefaultAsync(r => r.Description == "ScrumMaster");
                if (scrumRole == null) throw new InvalidOperationException("Role 'ScrumMaster' introuvable en base de données.");
                roleIdToAssign = scrumRole.Id;
            }
            else
            {
                if (dto.RoleId.HasValue && dto.RoleId.Value > 0)
                {
                    roleIdToAssign = dto.RoleId.Value;
                }
                else
                {
                    var devRole = await _db.Roles.FirstOrDefaultAsync(r => r.Description == "Developer");
                    if (devRole == null) throw new InvalidOperationException("Role 'Developer' introuvable en base de données.");
                    roleIdToAssign = devRole.Id;
                }
            }

            var user = new User
            {
                Nom = dto.Nom,
                Prenom = dto.Prenom,
                Email = dto.Email,
                RoleId = roleIdToAssign
            };
            user.Password = _passwordHasher.HashPassword(user, dto.Password);
            // Activation immédiate : utilisateur vérifié
            user.IsEmailVerified = true;
            user.VerificationCode = null;
            user.VerificationCodeExpiration = null;

            _db.Users.Add(user);
            var saved = await _db.SaveChangesAsync();
            if (saved <= 0) throw new InvalidOperationException("Impossible de créer l'utilisateur en base de données.");
        }

        public async Task<AuthResponseDto?> LoginAsync(LoginDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return null;
            var result = _passwordHasher.VerifyHashedPassword(user, user.Password, dto.Password);
            if (result == PasswordVerificationResult.Failed) return null;
            // Since registration now activates user immediately, no verification check needed
            var token = await GenerateTokenAsync(user);
            return new AuthResponseDto { Token = token, Email = user.Email, Role = (await _db.Roles.FindAsync(user.RoleId))?.Description ?? string.Empty, Expiration = DateTime.UtcNow.AddMinutes(int.Parse(_config["Jwt:ExpiryInMinutes"] ?? "60")), ProfileImageUrl = user.ProfileImageUrl };
        }

        public async Task<bool> ForgotPasswordAsync(Application.DTO.Auth.ForgotPasswordDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return false;
            var token = new Random().Next(100000, 999999).ToString();
            user.ResetPasswordToken = token;
            user.ResetPasswordExpiration = DateTime.UtcNow.AddHours(1);
            _db.Users.Update(user);
            var saved = await _db.SaveChangesAsync();
            if (saved <= 0) return false;
            // No email sending in this build; token is stored for client-driven workflows
            return true;
        }

        public async Task<bool> ResetPasswordAsync(Application.DTO.Auth.ResetPasswordDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return false;
            if (user.ResetPasswordToken == null) return false;
            if (user.ResetPasswordExpiration == null || user.ResetPasswordExpiration < DateTime.UtcNow) return false;
            if (user.ResetPasswordToken != dto.Token) return false;
            user.Password = _passwordHasher.HashPassword(user, dto.NewPassword);
            user.ResetPasswordToken = null;
            user.ResetPasswordExpiration = null;
            _db.Users.Update(user);
            return await _db.SaveChangesAsync() > 0;
        }

        private async Task<string> GenerateTokenAsync(User user)
        {
            var secret = _config["Jwt:SecretKey"] ?? throw new InvalidOperationException("Jwt:SecretKey not configured");
            var issuer = _config["Jwt:Issuer"] ?? "";
            var audience = _config["Jwt:Audience"] ?? "";
            var expiryMinutes = int.Parse(_config["Jwt:ExpiryInMinutes"] ?? "60");

            var role = await _db.Roles.FindAsync(user.RoleId);
            var roleDesc = role?.Description ?? string.Empty;

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, roleDesc)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
                signingCredentials: creds
            );
            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
