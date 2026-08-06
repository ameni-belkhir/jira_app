using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateUserPermissionsDto
    {
        [Required]
        public ICollection<UserPermissionDto> Permissions { get; set; } = new List<UserPermissionDto>();
    }
}
