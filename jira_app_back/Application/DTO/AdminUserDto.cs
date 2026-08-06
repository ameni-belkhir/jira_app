using System;

namespace Application.DTO
{
    public class AdminUserDto
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string Prenom { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int RoleId { get; set; }
        public string Role { get; set; } = string.Empty;
        public DateTime DateInscription { get; set; }
        public bool IsEmailVerified { get; set; }
    }
}
