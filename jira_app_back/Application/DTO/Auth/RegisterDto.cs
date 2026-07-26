using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Auth
{
    public class RegisterDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;

        [Required]
        public string Prenom { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;

        // RoleId optionnel : si absent, le service d'auth attribuera un rôle par défaut
        public int? RoleId { get; set; }
    }
}
