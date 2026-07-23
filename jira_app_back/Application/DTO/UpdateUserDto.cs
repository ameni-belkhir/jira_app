using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateUserDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Nom { get; set; } = string.Empty;

        [Required]
        public string Prenom { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        // Password may be optional on update depending on your rules
        public string? Password { get; set; }

        [Required]
        public int RoleId { get; set; }
    }
}
