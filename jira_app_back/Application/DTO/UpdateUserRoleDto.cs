using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    public class UpdateUserRoleDto
    {
        [Range(1, int.MaxValue)]
        public int RoleId { get; set; }
    }
}
