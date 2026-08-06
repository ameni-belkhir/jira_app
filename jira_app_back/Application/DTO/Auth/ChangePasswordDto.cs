using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Auth
{
    public class ChangePasswordDto
    {
        [Required]
        [MinLength(8)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
