using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class CreateUserByAdminDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;

        [Required]
        public string Prenom { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Range(1, int.MaxValue)]
        public int RoleId { get; set; }
    }
}
