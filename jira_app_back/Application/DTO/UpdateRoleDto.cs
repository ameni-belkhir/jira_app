using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateRoleDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Description { get; set; } = string.Empty;
    }
}
