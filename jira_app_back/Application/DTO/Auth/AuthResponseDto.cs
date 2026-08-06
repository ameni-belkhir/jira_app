using System;
using System.Collections.Generic;

namespace Application.DTO.Auth
{
    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime Expiration { get; set; }
        public string? ProfileImageUrl { get; set; }
        public bool MustChangePassword { get; set; }
        public List<string> Permissions { get; set; } = new List<string>();
    }
}
