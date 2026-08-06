using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UserPermissionDto
    {
        [Required]
        public string InterfaceKey { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
    }
}
