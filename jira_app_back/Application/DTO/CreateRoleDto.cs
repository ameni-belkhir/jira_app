using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class CreateRoleDto
    {
        [Required]
        public string Description { get; set; } = string.Empty;
    }
}
